import type {
  AssignmentNode,
  DirectiveNode,
  IdentifierNode,
  LiteralNode,
  ObjectEntryNode,
  ObjectMemberNode,
  ObjectNode,
  PathNode,
  TatNode,
} from "../../ast/nodes.js";
import type {
  V3EdgeInstance,
  V3FlowTarget,
  V3GraphInstance,
  V3MutationChange,
  V3RuntimeContext,
} from "../context.js";
import { evaluateV3Value } from "../evaluation/evaluateValue.js";
import { recordRuntimeEvent } from "../events.js";
import { evaluateWhenListeners } from "./when.js";

export interface RuntimeTargetPath {
  subject: string;
  key: string;
  path: string;
}

export function findEntryValue(object: ObjectNode, key: string): TatNode | undefined {
  return object.entries.find(
    (entry): entry is ObjectEntryNode => entry.kind === "ObjectEntry" && keyName(entry.key) === key,
  )?.value;
}

export function arrayItems(node: TatNode | undefined): TatNode[] {
  return node?.kind === "Array" ? node.items : [];
}

export function referenceArray(node: TatNode | undefined): string[] {
  return arrayItems(node).map((item) => referenceValue(item)).filter((value): value is string => Boolean(value));
}

export function directiveDomain(directive: DirectiveNode): string | undefined {
  return referenceValue(directive.args[0]);
}

export function objectEntries(object: ObjectNode): ObjectEntryNode[] {
  return object.entries.filter((entry): entry is ObjectEntryNode => entry.kind === "ObjectEntry");
}

export function objectCriteria(
  object: ObjectNode,
  context: V3RuntimeContext,
  graph: V3GraphInstance,
): Record<string, unknown> {
  const criteria: Record<string, unknown> = {};
  for (const entry of objectEntries(object)) {
    const key = keyName(entry.key);
    if (!key) continue;
    criteria[key] = semanticValue(entry.value, context, graph);
  }
  return criteria;
}

export function edgeMatches(edge: V3EdgeInstance, criteria: Record<string, unknown>): boolean {
  return Object.entries(criteria).every(([key, value]) => {
    if (key === "id") return edge.id === value;
    if (key === "from") return edge.from === value;
    if (key === "relation") return edge.relation === value;
    if (key === "to") return edge.to === value;
    return false;
  });
}

export function memberReference(member: ObjectMemberNode): string | undefined {
  if (member.kind === "ObjectEntry") return keyName(member.key);
  if (member.kind === "Identifier") return member.name;
  if (member.kind === "Path") return member.parts.map((part) => part.name).join(".");
  if (member.kind === "Literal") return member.value === null ? undefined : String(member.value);
  return undefined;
}

export function memberTargetPath(member: ObjectMemberNode): RuntimeTargetPath | undefined {
  if (member.kind === "ObjectEntry") return targetPath(member.key);
  if (member.kind === "Assignment") return assignmentTargetPath(member);
  if (member.kind === "Identifier") return undefined;
  if (member.kind === "Path") return partsToTargetPath(member.parts.map((part) => part.name));
  if (member.kind === "Literal" && member.literalKind === "string") return partsToTargetPath(member.value.split("."));
  return undefined;
}

export function assignmentTargetPath(assignment: AssignmentNode): RuntimeTargetPath | undefined {
  if (assignment.target.kind === "Identifier") return undefined;
  return partsToTargetPath(assignment.target.parts.map((part) => part.name));
}

export function resolveTargetAlias(target: RuntimeTargetPath | undefined, context: V3RuntimeContext): RuntimeTargetPath | undefined {
  if (!target) return undefined;
  const binding = context.bindings[target.subject];
  if (!binding || binding.type !== "primitive" || typeof binding.value !== "string") return target;

  return {
    subject: binding.value,
    key: target.key,
    path: `${binding.value}.${target.key}`,
  };
}

export function targetPath(key: IdentifierNode | PathNode | LiteralNode): RuntimeTargetPath | undefined {
  return partsToTargetPath(pathParts(key));
}

export function partsToTargetPath(parts: string[]): RuntimeTargetPath | undefined {
  const [subject, ...rest] = parts;
  const key = rest.join(".");
  if (!subject || !key) return undefined;
  return {
    subject,
    key,
    path: [subject, key].join("."),
  };
}

export function isMutableEdgeField(key: string): key is "from" | "relation" | "to" {
  return key === "from" || key === "relation" || key === "to";
}

export function recordMutationEvent(
  context: V3RuntimeContext,
  target: V3FlowTarget,
  directive: "graft" | "prune" | "update",
  domain: string,
  changes: V3MutationChange[],
  detail: Record<string, unknown> = {},
): void {
  if (changes.length === 0) return;
  const event = {
    type: "mutation",
    ...(target.type === "graph" ? { graph: target.id } : { network: target.id }),
    directive,
    domain,
    changes,
    detail,
  };
  recordRuntimeEvent(context, target, event);
  evaluateWhenListeners(context, target, changes);
}

export function keyName(key: IdentifierNode | PathNode | LiteralNode): string | undefined {
  if (key.kind === "Identifier") return key.name;
  if (key.kind === "Path") return key.parts.map((part) => part.name).join(".");
  if (key.literalKind === "string") return key.value;
  return undefined;
}

export function pathParts(key: IdentifierNode | PathNode | LiteralNode): string[] {
  if (key.kind === "Identifier") return [key.name];
  if (key.kind === "Path") return key.parts.map((part) => part.name);
  if (key.literalKind === "string") return key.value.split(".");
  return [];
}

export function referenceValue(node: TatNode | IdentifierNode | PathNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.kind === "Identifier") return node.name;
  if (node.kind === "Path") return node.parts.map((part) => part.name).join(".");
  if (node.kind === "Literal" && node.literalKind === "string") return node.value;
  return undefined;
}

function semanticValue(node: TatNode, context: V3RuntimeContext, graph: V3GraphInstance): unknown {
  if (node.kind === "Identifier") return node.name;
  if (node.kind === "Path") return node.parts.map((part) => part.name).join(".");
  return evaluateV3Value(node, { runtime: context, graph });
}

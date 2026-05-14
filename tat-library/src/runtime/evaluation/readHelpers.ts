import type { IdentifierNode, LiteralNode, ObjectEntryNode, ObjectNode, PathNode, TatNode } from "../../ast/nodes.js";
import type { V3EdgeInstance, V3GraphInstance, V3RuntimeContext, V3RuntimeEvent } from "../context.js";
import type { V3EvaluationContext } from "./evaluateValue.js";

export function matchesExpected(actual: unknown, expected: unknown): boolean {
  if (isComparator(expected)) {
    return compareValues(actual, expected.comparator, expected.right);
  }

  return actual === expected;
}

export function compareValues(left: unknown, operator: string, right: unknown): boolean {
  if (operator === "==") return left === right;
  if (operator === "!=") return left !== right;
  if (operator === "<") return toNumber(left) < toNumber(right);
  if (operator === ">") return toNumber(left) > toNumber(right);
  if (operator === "<=") return toNumber(left) <= toNumber(right);
  if (operator === ">=") return toNumber(left) >= toNumber(right);
  return false;
}

export function isComparator(value: unknown): value is { comparator: string; right: unknown } {
  return typeof value === "object" && value !== null && "comparator" in value && "right" in value;
}

export function recordEvent(context: V3EvaluationContext, event: V3RuntimeEvent): void {
  context.runtime.events.push(event);
  const graph = event.graph ? context.runtime.graphs[event.graph] : context.graph;
  graph?.history.push(event);
}

export function firstGraph(runtime: V3RuntimeContext): V3GraphInstance | undefined {
  return Object.values(runtime.graphs)[0];
}

export function runtimeBindingValue(binding: V3RuntimeContext["bindings"][string]): unknown {
  if (binding.type === "primitive") return binding.value;
  if (binding.type === "read") return binding.value;
  if (binding.type === "nodeDefinition") return binding.data;
  return binding;
}

export function edgeProperty(edge: V3EdgeInstance, key: string): unknown {
  if (key === "from") return edge.from;
  if (key === "relation") return edge.relation;
  if (key === "to") return edge.to;
  if (key === "explicit") return edge.explicit;
  if (key === "id") return edge.id;
  return undefined;
}

export function readProperty(value: unknown, path: string): unknown {
  const parts = path.split(".");
  let current = value;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export function argName(node: TatNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.kind === "Identifier") return node.name;
  if (node.kind === "Literal") return String(node.value);
  return undefined;
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

export function findEntryValue(object: ObjectNode, key: string): TatNode | undefined {
  return object.entries.find(
    (entry): entry is ObjectEntryNode => entry.kind === "ObjectEntry" && keyName(entry.key) === key,
  )?.value;
}

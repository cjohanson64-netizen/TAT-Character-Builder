import type {
  FlowStepNode,
  IdentifierNode,
  LiteralNode,
  ObjectEntryNode,
  ObjectNode,
  PathNode,
  TatNode,
} from "../../../ast/nodes.js";
import type {
  V3FlowTarget,
  V3GraphInstance,
  V3InjectionContext,
  V3PrimitiveValue,
  V3RuntimeContext,
} from "../../context.js";
import { evaluateV3Value } from "../../evaluation/evaluateValue.js";
import { runtimeError } from "../../events.js";

export function findEntryValue(object: ObjectNode, key: string): TatNode | undefined {
  return object.entries.find(
    (entry): entry is ObjectEntryNode => entry.kind === "ObjectEntry" && keyName(entry.key) === key,
  )?.value;
}

export function arrayItems(node: TatNode | undefined): TatNode[] {
  return node?.kind === "Array" ? node.items : [];
}

export function createScopedContext(
  context: V3RuntimeContext,
  params: string[],
  values: unknown[],
  argNodes: TatNode[],
): V3RuntimeContext {
  const bindings: V3RuntimeContext["bindings"] = { ...context.bindings };

  params.forEach((param, index) => {
    const value = values[index] ?? null;
    const node = argNodes[index] ?? runtimeNodeForValue(value);
    bindings[param] = isPrimitive(value)
      ? { type: "primitive", value, node }
      : { type: "read", value, node };
  });

  return {
    ...context,
    bindings,
  };
}

export function invocationArgValue(node: TatNode | undefined, context: V3RuntimeContext, target: V3FlowTarget): unknown {
  if (!node) return undefined;
  if (node.kind === "Identifier") return node.name;
  if (node.kind === "Path") return node.parts.map((part) => part.name).join(".");
  return evaluateV3Value(node, { runtime: context, ...(target.type === "graph" ? { graph: target } : { network: target }) });
}

export function stringFromValue(node: TatNode | undefined, context: V3RuntimeContext, target: V3FlowTarget): string | undefined {
  if (!node) return undefined;
  const value = invocationArgValue(node, context, target);
  return value === undefined || value === null ? undefined : String(value);
}

export function displayPath(node: TatNode): string | undefined {
  if (node.kind === "Path") return node.parts.map((part) => part.name).join(".");
  if (node.kind === "Identifier") return node.name;
  if (node.kind === "Literal") return node.value === null ? undefined : String(node.value);
  return undefined;
}

export function emptyObject(): ObjectNode {
  return { kind: "Object", entries: [] };
}

export function referenceValue(node: TatNode | IdentifierNode | PathNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.kind === "Identifier") return node.name;
  if (node.kind === "Path") return node.parts.map((part) => part.name).join(".");
  if (node.kind === "Literal") return valueToString(node);
  return undefined;
}

export function literalString(node: TatNode | undefined): string | undefined {
  if (!node || node.kind !== "Literal" || node.literalKind !== "string") return undefined;
  return node.value;
}

export function runInjectionHook(
  hookRef: string,
  run: (ctx: V3InjectionContext) => string,
  context: V3RuntimeContext,
  graph: V3GraphInstance,
): string {
  try {
    return run({
      graph,
      root: graph.root,
      nodes: graph.nodes,
      edges: graph.edges,
      state: graph.state,
      meta: graph.meta,
      bindings: context.bindings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : `Injection hook "${hookRef}" failed.`;
    runtimeError(context, message);
    return "";
  }
}

export function validateInjectedFlowSteps(steps: FlowStepNode[]): string[] {
  const errors: string[] = [];
  for (const step of steps) {
    if (step.kind === "Gate") continue;
    if (step.operator === "<-" || step.value.kind !== "Directive") continue;
    if (step.value.name === "seed" || step.value.name === "action" || step.value.name === "project") {
      errors.push(`@${step.value.name}(...) is not allowed in injected TAT.`);
    }
  }
  return errors;
}

export function keyName(key: IdentifierNode | PathNode | LiteralNode): string | undefined {
  if (key.kind === "Identifier") return key.name;
  if (key.kind === "Path") return key.parts.map((part) => part.name).join(".");
  if (key.literalKind === "string") return key.value;
  return undefined;
}

function runtimeNodeForValue(value: unknown): LiteralNode {
  if (typeof value === "number") return { kind: "Literal", literalKind: "number", value };
  if (typeof value === "boolean") return { kind: "Literal", literalKind: "boolean", value };
  if (value === null || value === undefined) return { kind: "Literal", literalKind: "null", value: null };
  return { kind: "Literal", literalKind: "string", value: String(value) };
}

function isPrimitive(value: unknown): value is V3PrimitiveValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null;
}

function literalValue(node: LiteralNode): V3PrimitiveValue {
  return node.value;
}

function valueToString(node: IdentifierNode | LiteralNode): string | undefined {
  if (node.kind === "Identifier") return node.name;
  const value = literalValue(node);
  return value === null ? undefined : String(value);
}

import type { IdentifierNode, LiteralNode, PathNode, TatNode } from "../../ast/nodes.js";
import type { V3FlowTarget, V3PrimitiveValue, V3RuntimeContext } from "../context.js";

export function resolveFlowSource(source: TatNode, context: V3RuntimeContext): V3FlowTarget | undefined {
  const name = referenceValue(source);
  if (!name) return undefined;

  const binding = context.bindings[name];
  if (binding?.type === "graph" || binding?.type === "network") return binding;

  return context.graphs[name] ?? context.networks[name];
}

function referenceValue(node: TatNode | IdentifierNode | PathNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.kind === "Identifier") return node.name;
  if (node.kind === "Path") return node.parts.map((part) => part.name).join(".");
  if (node.kind === "Literal") return valueToString(node);
  return undefined;
}

function literalValue(node: LiteralNode): V3PrimitiveValue {
  return node.value;
}

function valueToString(node: IdentifierNode | LiteralNode): string | undefined {
  if (node.kind === "Identifier") return node.name;
  const value = literalValue(node);
  return value === null ? undefined : String(value);
}

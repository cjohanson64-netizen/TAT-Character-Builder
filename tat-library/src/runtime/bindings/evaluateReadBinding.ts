import type { BindingNode } from "../../ast/nodes.js";
import { evaluateV3Value } from "../evaluation/evaluateValue.js";
import type {
  V3GraphInstance,
  V3PrimitiveValue,
  V3RuntimeContext,
  V3RuntimeValue,
} from "../context.js";

export function evaluateReadBinding(binding: BindingNode, context: V3RuntimeContext): V3RuntimeValue {
  const value = evaluateV3Value(binding.value, {
    runtime: context,
    graph: firstGraph(context),
  });

  if (isPrimitive(value)) {
    return {
      type: "primitive",
      value,
      node: binding.value,
    };
  }

  return {
    type: "read",
    value,
    node: binding.value,
  };
}

function firstGraph(context: V3RuntimeContext): V3GraphInstance | undefined {
  return Object.values(context.graphs)[0];
}

function isPrimitive(value: unknown): value is V3PrimitiveValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null;
}

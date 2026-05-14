import type { GateNode } from "../ast/nodes.js";
import { evaluateV3Value } from "./evaluation/evaluateValue.js";
import type { V3FlowTarget, V3RuntimeContext } from "./context.js";

export function evaluateGate(
  gate: GateNode,
  context: V3RuntimeContext,
  target: V3FlowTarget,
  currentGateChainExecuted: boolean,
): boolean {
  const evaluationContext = {
    runtime: context,
    ...(target.type === "graph" ? { graph: target } : { network: target }),
  };

  if (gate.operator === ":>") {
    const condition = gate.condition ? truthy(evaluateV3Value(gate.condition, evaluationContext)) : true;
    return !currentGateChainExecuted && condition;
  }

  const condition = gate.condition ? truthy(evaluateV3Value(gate.condition, evaluationContext)) : false;
  return gate.operator === "!>" ? !condition : condition;
}

export function truthy(value: unknown): boolean {
  if (typeof value === "object" && value !== null) {
    if ("result" in value && typeof (value as { result: unknown }).result === "boolean") {
      return (value as { result: boolean }).result;
    }
    if ("has" in value && typeof (value as { has: unknown }).has === "boolean") {
      return (value as { has: boolean }).has;
    }
    if ("count" in value && typeof (value as { count: unknown }).count === "number") {
      return (value as { count: number }).count > 0;
    }
  }

  return Boolean(value);
}

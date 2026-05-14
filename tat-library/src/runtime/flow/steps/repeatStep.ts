import type { DirectiveNode } from "../../../ast/nodes.js";
import type {
  V3FlowTarget,
  V3RuntimeContext,
  V3RuntimeEvent,
} from "../../context.js";
import { evaluateV3Value } from "../../evaluation/evaluateValue.js";
import { truthy } from "../../executeGate.js";
import { recordRuntimeEvent } from "../../events.js";
import {
  executeFlowSteps,
  type ProjectionBucket,
} from "../executeFlowSteps.js";
import { findEntryValue } from "./stepHelpers.js";

export function executeRepeat(
  directive: DirectiveNode,
  context: V3RuntimeContext,
  target: V3FlowTarget,
  projections: ProjectionBucket,
): void {
  const body = directive.body?.kind === "Object" ? directive.body : undefined;
  const actionValue = body ? findEntryValue(body, "action") : undefined;
  if (!body || actionValue?.kind !== "FlowBody") return;

  const maxIterationsNode = findEntryValue(body, "maxIterations");

  if (!maxIterationsNode) {
    context.diagnostics.push({
      severity: "error",
      message: "@repeat requires maxIterations.",
    });
    return;
  }

  const limitValue = evaluateV3Value(maxIterationsNode, {
    runtime: context,
    ...(target.type === "graph" ? { graph: target } : { network: target }),
  });

  const limit =
    typeof limitValue === "number" && Number.isFinite(limitValue)
      ? Math.max(0, Math.floor(limitValue))
      : undefined;
  const whileCondition = findEntryValue(body, "while");
  const repeatEvent: V3RuntimeEvent = {
    type: "repeat",
    ...(target.type === "graph"
      ? { graph: target.id }
      : { network: target.id }),
    iterations: 0,
    limit,
    stoppedBy: "none",
    executedSteps: [],
  };
  recordRuntimeEvent(context, target, repeatEvent);

  let iterations = 0;
  let stoppedBy: V3RuntimeEvent["stoppedBy"] = "none";
  const startEventIndex = context.events.length;

  while (limit === undefined || iterations < limit) {
    if (
      whileCondition &&
      !truthy(
        evaluateV3Value(whileCondition, {
          runtime: context,
          ...(target.type === "graph"
            ? { graph: target }
            : { network: target }),
        }),
      )
    ) {
      stoppedBy = "while";
      break;
    }

    executeFlowSteps(actionValue.steps, context, target, projections);
    iterations += 1;
  }

  if (stoppedBy === "none" && limit !== undefined && iterations >= limit) {
    stoppedBy = "times";
  }

  repeatEvent.iterations = iterations;
  repeatEvent.stoppedBy = stoppedBy;
  repeatEvent.executedSteps = context.events.slice(startEventIndex);
}

import type { FlowStepNode } from "../../ast/nodes.js";
import type { V3FlowTarget, V3RuntimeContext } from "../context.js";
import { evaluateGate } from "../executeGate.js";
import { recordRuntimeEvent } from "../events.js";
import { executeFlowStep } from "./executeFlowStep.js";

export type ProjectionBucket = Record<string, unknown>;

export function executeFlowSteps(
  steps: FlowStepNode[],
  context: V3RuntimeContext,
  target: V3FlowTarget,
  projections: ProjectionBucket,
): void {
  let activeSegment = true;
  let inGateChain = false;
  let currentGateChainPassed = true;
  let currentGateChainExecuted = false;

  for (const step of steps) {
    if (step.kind === "Gate") {
      const passed = evaluateGate(
        step,
        context,
        target,
        currentGateChainExecuted,
      );

      if (step.operator === "?>") {
        currentGateChainPassed = inGateChain
          ? currentGateChainPassed && passed
          : passed;

        activeSegment = currentGateChainPassed;
        inGateChain = true;
        currentGateChainExecuted = currentGateChainPassed;
      } else if (step.operator === "!>") {
        currentGateChainPassed = inGateChain
          ? currentGateChainPassed && passed
          : passed;

        activeSegment = currentGateChainPassed;
        inGateChain = true;
        currentGateChainExecuted = currentGateChainPassed;
      } else if (step.operator === ":>") {
        const elsePassed: boolean = !currentGateChainExecuted && passed;

        activeSegment = elsePassed;
        currentGateChainPassed = elsePassed;
        inGateChain = true;
        currentGateChainExecuted = currentGateChainExecuted || elsePassed;
      } else {
        activeSegment = passed;
        currentGateChainPassed = passed;
        inGateChain = true;
        currentGateChainExecuted = passed;
      }

      recordRuntimeEvent(context, target, {
        type: "gate",
        ...(target.type === "graph"
          ? { graph: target.id }
          : { network: target.id }),
        operator: step.operator,
        passed: activeSegment,
      });

      continue;
    }

    if (activeSegment) {
      executeFlowStep(step, context, target, projections);
    }

    // A non-gate step ends the current gate chain. The next gate starts fresh.
    activeSegment = true;
    inGateChain = false;
    currentGateChainPassed = true;
    currentGateChainExecuted = false;
  }
}

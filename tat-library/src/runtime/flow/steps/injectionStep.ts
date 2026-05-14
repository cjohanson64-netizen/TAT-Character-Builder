import { parseInjectedFlowFragment } from "../../../parser/parseInjectedFlowFragment.js";
import type { DirectiveNode, FlowStepNode } from "../../../ast/nodes.js";
import type { V3GraphInstance, V3RuntimeContext, V3RuntimeEvent } from "../../context.js";
import { recordRuntimeEvent, runtimeError } from "../../events.js";
import { executeFlowSteps, type ProjectionBucket } from "../executeFlowSteps.js";
import {
  literalString,
  referenceValue,
  runInjectionHook,
  validateInjectedFlowSteps,
} from "./stepHelpers.js";

export function executeInjectionStep(
  directive: DirectiveNode,
  context: V3RuntimeContext,
  graph: V3GraphInstance,
  projections: ProjectionBucket,
): void {
  if (directive.name !== "inject") return;

  const hookRef = referenceValue(directive.args[0]);
  const fileName = literalString(directive.args[1]);
  if (!hookRef) return;

  const hook = context.options?.injections?.[hookRef];
  if (!hook) {
    runtimeError(context, `Missing injection hook "${hookRef}".`);
    return;
  }

  if (fileName !== hook.fileName) {
    runtimeError(context, `Injection hook "${hookRef}" expected file "${hook.fileName}" but received "${fileName ?? ""}".`);
    return;
  }

  const generatedTat = runInjectionHook(hookRef, hook.run, context, graph);
  const injectionEvent: V3RuntimeEvent = {
    type: "injection",
    graph: graph.id,
    hook: hookRef,
    file: fileName,
    generatedTat,
    diagnostics: {
      parse: "success",
      validation: "success",
      errors: [],
    },
    executedSteps: [],
  };
  recordRuntimeEvent(context, graph, injectionEvent);

  let steps: FlowStepNode[];
  try {
    steps = parseInjectedFlowFragment(generatedTat);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse injected TAT.";
    injectionEvent.diagnostics = {
      parse: "error",
      validation: "error",
      errors: [message],
    };
    runtimeError(context, message);
    return;
  }

  const validationErrors = validateInjectedFlowSteps(steps);
  if (validationErrors.length > 0) {
    injectionEvent.diagnostics = {
      parse: "success",
      validation: "error",
      errors: validationErrors,
    };
    validationErrors.forEach((message) => runtimeError(context, message));
    return;
  }

  const startEventIndex = context.events.length;
  executeFlowSteps(steps, context, graph, projections);
  injectionEvent.executedSteps = context.events.slice(startEventIndex);
}

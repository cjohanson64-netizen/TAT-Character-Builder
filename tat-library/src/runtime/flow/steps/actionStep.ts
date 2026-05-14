import type { InvocationNode } from "../../../ast/nodes.js";
import type { V3FlowTarget, V3RuntimeContext } from "../../context.js";
import { recordRuntimeEvent, runtimeError } from "../../events.js";
import { executeFlowSteps, type ProjectionBucket } from "../executeFlowSteps.js";
import { createScopedContext, invocationArgValue, referenceValue } from "./stepHelpers.js";

export function executeActionInvocation(
  invocation: InvocationNode,
  context: V3RuntimeContext,
  target: V3FlowTarget,
  projections: ProjectionBucket,
): void {
  const actionName = referenceValue(invocation.callee);
  const constructor = actionName ? context.bindings[actionName] : undefined;
  if (!actionName || constructor?.type !== "constructor" || constructor.constructorKind !== "action") {
    runtimeError(context, "Action invocation runtime is not implemented yet.");
    return;
  }

  const args = invocation.args.map((arg) => invocationArgValue(arg, context, target));
  const scopedContext = createScopedContext(context, constructor.params, args, invocation.args);
  recordRuntimeEvent(context, target, {
    type: "action",
    ...(target.type === "graph" ? { graph: target.id } : { network: target.id }),
    name: actionName,
    args,
  });

  if (constructor.body?.kind === "FlowBody") {
    executeFlowSteps(constructor.body.steps, scopedContext, target, projections);
  }
}

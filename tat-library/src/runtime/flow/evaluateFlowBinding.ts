import type { BindingNode, FlowNode } from "../../ast/nodes.js";
import type { V3RuntimeContext, V3RuntimeValue } from "../context.js";
import { executeFlowSteps, type ProjectionBucket } from "./executeFlowSteps.js";
import { resolveFlowSource } from "./resolveFlowSource.js";

export function evaluateFlowBinding(
  binding: BindingNode,
  flow: FlowNode,
  context: V3RuntimeContext,
): V3RuntimeValue {
  const target = resolveFlowSource(flow.sourceNode, context);

  if (!target) {
    context.diagnostics.push({
      severity: "error",
      message: "Flow source must resolve to a graph or network binding.",
    });

    return {
      type: "flowResult",
      value: { events: [] },
      node: flow,
    };
  }

  const startEventIndex = context.events.length;
  const projections: ProjectionBucket = {};

  executeFlowSteps(flow.steps, context, target, projections);
  Object.assign(context.projections, projections);

  const bindingName = binding.name.name;

  if (target.type === "graph") {
    context.graphs[bindingName] = target;
    context.bindings[bindingName] = target;

    return target;
  }

  if (target.type === "network") {
    context.networks[bindingName] = target;
    context.bindings[bindingName] = target;

    return target;
  }

  return {
    type: "flowResult",
    value: {
      events: context.events.slice(startEventIndex),
      projections,
    },
    node: flow,
  };
}
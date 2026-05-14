import type { DirectiveNode, InvocationNode, ObjectNode } from "../../../ast/nodes.js";
import { buildExplanationOutput } from "../../projections/explanation.js";
import { buildNetworkTopologyProjection } from "../../projections/networkTopology.js";
import type { V3FlowTarget, V3RuntimeContext } from "../../context.js";
import { evaluateV3Value } from "../../evaluation/evaluateValue.js";
import { recordRuntimeEvent, runtimeError } from "../../events.js";
import type { ProjectionBucket } from "../executeFlowSteps.js";
import {
  arrayItems,
  createScopedContext,
  displayPath,
  emptyObject,
  findEntryValue,
  invocationArgValue,
  referenceValue,
  stringFromValue,
} from "./stepHelpers.js";

export function executeProjectionStep(
  value: DirectiveNode | InvocationNode,
  context: V3RuntimeContext,
  target: V3FlowTarget,
  projections: ProjectionBucket,
): void {
  if (value.kind === "Invocation") {
    executeProjectionInvocation(value, context, target, projections);
    return;
  }

  if (value.name === "project") {
    const projection = executeInlineProject(value, context, target);
    projections.project = projection;
    recordProjectionEvent(context, target, "project", "project");
    return;
  }

  if (isExplanationProjectionName(value.name)) {
    recordProjectionEvent(context, target, `@${value.name}`, value.name);
    projections[value.name] = buildExplanationOutput(value.name, context.events);
  }
}

export function executeProjectionInvocation(
  invocation: InvocationNode,
  context: V3RuntimeContext,
  target: V3FlowTarget,
  projections: ProjectionBucket,
): void {
  const projectionName = referenceValue(invocation.callee);
  const constructor = projectionName ? context.bindings[projectionName] : undefined;
  if (!projectionName || constructor?.type !== "constructor" || constructor.constructorKind !== "projection") {
    runtimeError(context, `Unknown projection "${projectionName ?? ""}".`);
    return;
  }

  const args = invocation.args.map((arg) => invocationArgValue(arg, context, target));
  const scopedContext = createScopedContext(context, constructor.params, args, invocation.args);
  const body = constructor.body?.kind === "Object" ? constructor.body : undefined;
  const projection = buildProjectionOutput(body, scopedContext, target, String(args[0] ?? ""));
  projections.project = projection;
  recordProjectionEvent(context, target, projectionName, "project");
}

export function executeInlineProject(
  directive: DirectiveNode,
  context: V3RuntimeContext,
  target: V3FlowTarget,
): Record<string, unknown> {
  const body = directive.body?.kind === "Object" ? directive.body : undefined;
  const projectionTarget = invocationArgValue(directive.args[0], context, target);
  return buildProjectionOutput(body, context, target, projectionTarget === undefined ? undefined : String(projectionTarget));
}

function buildProjectionOutput(
  body: ObjectNode | undefined,
  context: V3RuntimeContext,
  runtimeTarget: V3FlowTarget,
  target: string | undefined,
): Record<string, unknown> {
  const format = stringFromValue(findEntryValue(body ?? emptyObject(), "format"), context, runtimeTarget) ?? "custom";
  if (format === "topology" && runtimeTarget.type === "network") {
    return buildNetworkTopologyProjection(runtimeTarget, context);
  }

  const include = findEntryValue(body ?? emptyObject(), "include");
  const data: Record<string, unknown> = {};

  for (const item of arrayItems(include)) {
    const key = displayPath(item);
    if (!key) continue;
    data[key] = evaluateV3Value(item, {
      runtime: context,
      ...(runtimeTarget.type === "graph" ? { graph: runtimeTarget } : { network: runtimeTarget }),
    });
  }

  return {
    kind: "project",
    format,
    target,
    data,
  };
}

function isExplanationProjectionName(name: string): name is "who" | "what" | "why" | "how" {
  return name === "who" || name === "what" || name === "why" || name === "how";
}

function recordProjectionEvent(
  context: V3RuntimeContext,
  target: V3FlowTarget,
  projection: string,
  kind: string,
): void {
  recordRuntimeEvent(context, target, {
    type: "projection",
    ...(target.type === "graph" ? { graph: target.id } : { network: target.id }),
    projection,
    detail: { kind },
  });
}

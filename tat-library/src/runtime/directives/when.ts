import type {
  DirectiveNode,
  IdentifierNode,
  LiteralNode,
  ObjectEntryNode,
  ObjectNode,
  PathNode,
  TatNode,
} from "../../ast/nodes.js";
import type {
  V3FlowTarget,
  V3MutationChange,
  V3RuntimeContext,
  V3RuntimeEvent,
  V3WhenListener,
} from "../context.js";
import { evaluateV3Value } from "../evaluation/evaluateValue.js";
import { truthy } from "../executeGate.js";
import { recordRuntimeEvent, runtimeError } from "../events.js";
import { executeFlowSteps } from "../flow/executeFlowSteps.js";

export function createWhenListener(node: DirectiveNode): V3WhenListener {
  const body = node.body?.kind === "Object" ? node.body : undefined;
  const domain = referenceValue(node.args[0]) ?? "unknown";
  const target = body ? referenceValue(findEntryValue(body, "target")) : undefined;
  const actionValue = body ? findEntryValue(body, "action") : undefined;

  return {
    event: `${domain}:${target ?? "unknown"}`,
    condition: body ? findEntryValue(body, "condition") : undefined,
    doBody: actionValue?.kind === "FlowBody" ? actionValue : undefined,
    node,
  };
}

export function evaluateWhenListeners(
  context: V3RuntimeContext,
  target: V3FlowTarget,
  changes: V3MutationChange[],
): void {
  const listeners = context.whenListeners ?? [];
  if (listeners.length === 0) return;

  for (const listener of listeners) {
    if (!listener.doBody || !shouldCheckListener(listener, changes)) continue;

    const condition = listener.condition
      ? evaluateV3Value(listener.condition, { runtime: context, ...(target.type === "graph" ? { graph: target } : { network: target }) })
      : true;
    if (!truthy(condition)) continue;

    const maxDepth = context.options?.maxTriggerDepth ?? 10;
    const depth = context.triggerDepth ?? 0;
    if (depth >= maxDepth) {
      runtimeError(context, `@when trigger depth exceeded maximum of ${maxDepth}.`);
      return;
    }

    const triggerEvent: V3RuntimeEvent = {
      type: "trigger",
      ...(target.type === "graph" ? { graph: target.id } : { network: target.id }),
      event: listener.event,
      activated: true,
      detail: { condition: triggerConditionSummary(condition) },
      executedSteps: [],
    };
    recordRuntimeEvent(context, target, triggerEvent);

    const startEventIndex = context.events.length;
    const triggerContext: V3RuntimeContext = {
      ...context,
      triggerDepth: depth + 1,
    };
    executeFlowSteps(listener.doBody.steps, triggerContext, target, {});
    triggerEvent.executedSteps = context.events.slice(startEventIndex);
  }
}

function shouldCheckListener(listener: V3WhenListener, changes: V3MutationChange[]): boolean {
  const target = listenerConditionTarget(listener.condition);
  if (!target) return true;
  return changes.some((change) => change.path === target || change.path.startsWith(`${target}.`));
}

function listenerConditionTarget(condition: TatNode | undefined): string | undefined {
  if (condition?.kind !== "Directive" || condition.name !== "query" || condition.body?.kind !== "Object") {
    return undefined;
  }

  const node = referenceValue(findEntryValue(condition.body, "node"));
  const key = referenceValue(findEntryValue(condition.body, "key"));
  return node && key ? `${node}.${key}` : undefined;
}

function triggerConditionSummary(condition: unknown): unknown {
  if (typeof condition === "object" && condition !== null && "domain" in condition && "condition" in condition) {
    const result = condition as { domain: unknown; condition: Record<string, unknown> };
    return {
      domain: result.domain,
      ...result.condition,
    };
  }

  return condition;
}

function findEntryValue(object: ObjectNode, key: string): TatNode | undefined {
  return object.entries.find(
    (entry): entry is ObjectEntryNode => entry.kind === "ObjectEntry" && keyName(entry.key) === key,
  )?.value;
}

function keyName(key: IdentifierNode | PathNode | LiteralNode): string | undefined {
  if (key.kind === "Identifier") return key.name;
  if (key.kind === "Path") return key.parts.map((part) => part.name).join(".");
  if (key.literalKind === "string") return key.value;
  return undefined;
}

function referenceValue(node: TatNode | IdentifierNode | PathNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.kind === "Identifier") return node.name;
  if (node.kind === "Path") return node.parts.map((part) => part.name).join(".");
  return undefined;
}

import type { V3FlowTarget, V3RuntimeContext, V3RuntimeEvent } from "./context.js";

export type { V3MutationChange, V3RuntimeEvent } from "./context.js";

export function recordRuntimeEvent(context: V3RuntimeContext, target: V3FlowTarget, event: V3RuntimeEvent): void {
  context.events.push(event);
  if (target.type === "graph") {
    target.history.push(event);
  } else {
    const op = event.directive === "graft" || event.directive === "prune" || event.directive === "update"
      ? event.directive
      : event.type === "projection"
        ? "project"
        : undefined;
    if (op) {
      target.history.push({
        op,
        target: target.id,
        added: event.detail?.added as Record<string, string[]> | undefined,
        removed: event.detail?.removed as Record<string, string[]> | undefined,
        reason: typeof event.detail?.reason === "string" ? event.detail.reason : undefined,
      });
    }
  }
}

export function runtimeError(context: V3RuntimeContext, message: string): void {
  context.diagnostics.push({
    severity: "error",
    message,
  });
}

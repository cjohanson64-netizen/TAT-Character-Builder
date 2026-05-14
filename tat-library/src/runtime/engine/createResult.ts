import type { V3RuntimeContext, V3RuntimeResult } from "../context.js";

export function createResult(context: V3RuntimeContext): V3RuntimeResult {
  return {
    status: context.diagnostics.some((diagnostic) => diagnostic.severity === "error") ? "error" : "success",
    bindings: context.bindings,
    graphs: context.graphs,
    bridges: context.bridges,
    networks: context.networks,
    projections: context.projections,
    events: context.events,
    diagnostics: context.diagnostics,
    exports: context.exports ?? {},
  };
}

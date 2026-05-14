import type { V3NetworkInstance, V3RuntimeContext } from "../context.js";

export function buildNetworkTopologyProjection(
  network: V3NetworkInstance,
  context: V3RuntimeContext,
): Record<string, unknown> {
  return {
    kind: "project",
    format: "topology",
    target: network.id,
    data: {
      anchor: network.anchor,
      graphs: network.graphs.map((id) => context.graphs[id] ?? id),
      bridges: network.bridges.map((id) => context.bridges[id] ?? id),
      contexts: network.contexts,
      hooks: network.hooks,
      state: network.state,
      meta: network.meta,
    },
  };
}

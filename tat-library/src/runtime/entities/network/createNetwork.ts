import type { TatNode } from "../../../ast/nodes.js";
import type { V3BridgeInstance, V3NetworkInstance, V3RuntimeContext } from "../../context.js";
import { runtimeError } from "../../events.js";

export interface CreateNetworkInput {
  id: string;
  anchor: string;
  graphs: string[];
  bridges: string[];
  contexts: string[];
  hooks: string[];
  state: Record<string, unknown>;
  meta: Record<string, unknown>;
}

export function createNetwork(input: CreateNetworkInput, context: V3RuntimeContext): V3NetworkInstance {
  const network: V3NetworkInstance = {
    type: "network",
    id: input.id,
    anchor: input.anchor,
    graphs: unique(input.graphs),
    bridges: unique(input.bridges),
    contexts: unique(input.contexts),
    hooks: unique(input.hooks),
    state: { ...input.state },
    meta: { ...input.meta },
    history: [],
  };

  validateNetworkReferences(network, context);
  network.history.push({ op: "seed", target: network.id, added: snapshotNetworkTopology(network) });
  return network;
}

export function snapshotNetworkTopology(network: V3NetworkInstance): Record<string, string[]> {
  return {
    graphs: [...network.graphs],
    bridges: [...network.bridges],
    contexts: [...network.contexts],
    hooks: [...network.hooks],
  };
}

export function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function bridgeFor(context: V3RuntimeContext, bridgeId: string): V3BridgeInstance | undefined {
  const binding = context.bindings[bridgeId];
  if (binding?.type === "bridge") return binding;
  return context.bridges[bridgeId];
}

export function validateNetworkReferences(network: V3NetworkInstance, context: V3RuntimeContext): void {
  if (network.anchor && !network.graphs.includes(network.anchor)) {
    runtimeError(context, `Network "${network.id}" anchor "${network.anchor}" must be registered in graphs.`);
  }

  for (const graph of network.graphs) {
    if (!context.graphs[graph] && context.bindings[graph]?.type !== "graph") {
      runtimeError(context, `Network "${network.id}" references missing graph "${graph}".`);
    }
  }

  for (const bridgeId of network.bridges) {
    const bridge = bridgeFor(context, bridgeId);
    if (!bridge) {
      runtimeError(context, `Network "${network.id}" references missing bridge "${bridgeId}".`);
      continue;
    }
    if (!network.graphs.includes(bridge.from) || !network.graphs.includes(bridge.to)) {
      runtimeError(context, `Bridge "${bridgeId}" must connect graphs registered in network "${network.id}".`);
    }
    if (bridge.context && !network.contexts.includes(bridge.context)) {
      runtimeError(context, `Bridge "${bridgeId}" references unregistered context "${bridge.context}".`);
    }
    for (const hook of bridge.hooks) {
      if (!network.hooks.includes(hook)) {
        runtimeError(context, `Bridge "${bridgeId}" references unregistered hook "${hook}".`);
      }
    }
  }
}

export function staticObjectValue(node: TatNode | undefined): Record<string, unknown> {
  if (!node || node.kind !== "Object") return {};
  const record: Record<string, unknown> = {};
  for (const entry of node.entries) {
    if (entry.kind !== "ObjectEntry") continue;
    const key = entry.key.kind === "Identifier"
      ? entry.key.name
      : entry.key.kind === "Path"
        ? entry.key.parts.map((part) => part.name).join(".")
        : entry.key.literalKind === "string"
          ? entry.key.value
          : undefined;
    if (!key) continue;
    record[key] = staticValue(entry.value);
  }
  return record;
}

function staticValue(node: TatNode): unknown {
  if (node.kind === "Literal") return node.value;
  if (node.kind === "Identifier") return node.name;
  if (node.kind === "Path") return node.parts.map((part) => part.name).join(".");
  if (node.kind === "Array") return node.items.map(staticValue);
  if (node.kind === "Object") return staticObjectValue(node);
  return undefined;
}

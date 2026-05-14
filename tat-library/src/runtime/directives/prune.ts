import type { DirectiveNode } from "../../ast/nodes.js";
import type { V3FlowTarget, V3GraphInstance, V3MutationChange, V3NetworkInstance, V3RuntimeContext } from "../context.js";
import { bridgeFor, validateNetworkReferences } from "../entities/network/createNetwork.js";
import {
  directiveDomain,
  edgeMatches,
  findEntryValue,
  memberReference,
  memberTargetPath,
  objectCriteria,
  recordMutationEvent,
  referenceArray,
} from "./mutationHelpers.js";

export function executePrune(directive: DirectiveNode, context: V3RuntimeContext, target: V3FlowTarget): void {
  const domain = directiveDomain(directive);
  if (domain === "network" && target.type === "network") {
    executeNetworkPrune(directive, context, target);
    return;
  }

  if (target.type === "graph") {
    executeGraphPrune(directive, context, target);
    return;
  }

  if (domain === "state" || domain === "meta") {
    executeNetworkStateMetaPrune(directive, context, target, domain);
  }
}

function executeGraphPrune(directive: DirectiveNode, context: V3RuntimeContext, graph: V3GraphInstance): void {
  const domain = directiveDomain(directive);
  const body = directive.body?.kind === "Object" ? directive.body : undefined;
  if (!domain || !body) return;

  const changes: V3MutationChange[] = [];

  if (domain === "node") {
    for (const entry of body.entries) {
      const id = memberReference(entry);
      if (!id || !graph.nodes[id]) continue;
      const previous = graph.nodes[id];
      delete graph.nodes[id];
      delete graph.state[id];
      delete graph.meta[id];
      delete graph.localBindings[id];

      for (const edge of Object.values(graph.edges)) {
        if (edge.from !== id && edge.to !== id) continue;
        delete graph.edges[edge.id];
        delete graph.localBindings[edge.id];
        changes.push({ path: edge.id, from: edge, operation: "remove" });
      }

      changes.push({ path: id, from: previous, operation: "remove" });
    }
  }

  if (domain === "edge") {
    const criteria = objectCriteria(body, context, graph);
    for (const edge of Object.values(graph.edges)) {
      if (!edgeMatches(edge, criteria)) continue;
      delete graph.edges[edge.id];
      delete graph.localBindings[edge.id];
      changes.push({ path: edge.id, from: edge, operation: "remove" });
    }
  }

  if (domain === "state" || domain === "meta") {
    const store = domain === "state" ? graph.state : graph.meta;
    for (const entry of body.entries) {
      const target = memberTargetPath(entry);
      if (!target || store[target.subject]?.[target.key] === undefined) continue;
      const previous = store[target.subject][target.key];
      delete store[target.subject][target.key];
      changes.push({ path: target.path, from: previous, operation: "remove" });
    }
  }

  recordMutationEvent(context, graph, "prune", domain, changes);
}

function executeNetworkPrune(directive: DirectiveNode, context: V3RuntimeContext, network: V3NetworkInstance): void {
  const body = directive.body?.kind === "Object" ? directive.body : undefined;
  if (!body) return;
  const changes: V3MutationChange[] = [];
  const removed: Record<string, string[]> = {};

  pruneList(network.bridges, referenceArray(findEntryValue(body, "bridges")), "bridges", changes, removed);
  pruneList(network.graphs, referenceArray(findEntryValue(body, "graphs")), "graphs", changes, removed);
  pruneList(network.hooks, referenceArray(findEntryValue(body, "hooks")), "hooks", changes, removed);
  pruneList(network.contexts, referenceArray(findEntryValue(body, "contexts")), "contexts", changes, removed);
  pruneOrphanedBridgeParts(network, context, changes, removed);
  validateNetworkReferences(network, context);
  recordMutationEvent(context, network, "prune", "network", changes, { removed });
}

function executeNetworkStateMetaPrune(
  directive: DirectiveNode,
  context: V3RuntimeContext,
  network: V3NetworkInstance,
  domain: "state" | "meta",
): void {
  const body = directive.body?.kind === "Object" ? directive.body : undefined;
  if (!body) return;
  const store = domain === "state" ? network.state : network.meta;
  const changes: V3MutationChange[] = [];
  for (const entry of body.entries) {
    const key = memberReference(entry);
    if (!key || key === "target" || store[key] === undefined) continue;
    const previous = store[key];
    delete store[key];
    changes.push({ path: key, from: previous, operation: "remove" });
  }
  recordMutationEvent(context, network, "prune", domain, changes);
}

function pruneList(
  current: string[],
  values: string[],
  key: string,
  changes: V3MutationChange[],
  removed: Record<string, string[]>,
): void {
  for (const value of values) {
    const index = current.indexOf(value);
    if (index < 0) continue;
    current.splice(index, 1);
    removed[key] ??= [];
    removed[key].push(value);
    changes.push({ path: `${key}.${value}`, from: value, operation: "remove" });
  }
}

function pruneOrphanedBridgeParts(
  network: V3NetworkInstance,
  context: V3RuntimeContext,
  changes: V3MutationChange[],
  removed: Record<string, string[]>,
): void {
  const remainingBridges = network.bridges.map((id) => bridgeFor(context, id)).filter(Boolean);
  const usedHooks = new Set(remainingBridges.flatMap((bridge) => bridge?.hooks ?? []));
  const usedContexts = new Set(remainingBridges.map((bridge) => bridge?.context).filter((value): value is string => Boolean(value)));
  for (const hook of [...network.hooks]) {
    if (usedHooks.has(hook)) continue;
    pruneList(network.hooks, [hook], "hooks", changes, removed);
  }
  for (const contextId of [...network.contexts]) {
    if (usedContexts.has(contextId)) continue;
    pruneList(network.contexts, [contextId], "contexts", changes, removed);
  }
}

import type { DirectiveNode } from "../../ast/nodes.js";
import type { V3FlowTarget, V3GraphInstance, V3MutationChange, V3NetworkInstance, V3RuntimeContext } from "../context.js";
import { evaluateV3Value } from "../evaluation/evaluateValue.js";
import { runtimeError } from "../events.js";
import {
  createEdgeDefinitionValue,
  createNodeDefinitionValue,
  createNodeInstance,
  edgeDefinitionToInstance,
} from "../graphInstance.js";
import { validateNetworkReferences } from "../entities/network/createNetwork.js";
import {
  directiveDomain,
  findEntryValue,
  keyName,
  objectEntries,
  recordMutationEvent,
  referenceArray,
  targetPath,
} from "./mutationHelpers.js";

export function executeGraft(directive: DirectiveNode, context: V3RuntimeContext, target: V3FlowTarget): void {
  const domain = directiveDomain(directive);
  if (domain === "network" && target.type === "network") {
    executeNetworkGraft(directive, context, target);
    return;
  }

  if (target.type === "graph") {
    executeGraphGraft(directive, context, target);
    return;
  }

  if (domain === "state" || domain === "meta") {
    executeNetworkStateMetaGraft(directive, context, target, domain);
  }
}

function executeGraphGraft(directive: DirectiveNode, context: V3RuntimeContext, graph: V3GraphInstance): void {
  const domain = directiveDomain(directive);
  const body = directive.body?.kind === "Object" ? directive.body : undefined;
  if (!domain || !body) return;

  const changes: V3MutationChange[] = [];

  if (domain === "node") {
    for (const entry of objectEntries(body)) {
      const id = keyName(entry.key);
      if (!id || entry.value.kind !== "NodeDefinition") continue;
      if (graph.nodes[id] || graph.localBindings[id]) {
        runtimeError(context, `Cannot graft node "${id}" because it already exists.`);
        continue;
      }

      const nodeValue = createNodeDefinitionValue(id, entry.value);
      graph.nodes[id] = createNodeInstance(nodeValue);
      graph.localBindings[id] = nodeValue;
      changes.push({ path: id, to: graph.nodes[id], operation: "add" });
    }
  }

  if (domain === "edge") {
    for (const entry of objectEntries(body)) {
      const id = keyName(entry.key);
      if (!id || entry.value.kind !== "Relationship" || entry.value.relationshipKind !== "edge") continue;
      if (graph.edges[id] || graph.localBindings[id]) {
        runtimeError(context, `Cannot graft edge "${id}" because it already exists.`);
        continue;
      }

      const edgeValue = createEdgeDefinitionValue(id, entry.value);
      const edge = edgeDefinitionToInstance(edgeValue);
      graph.edges[id] = edge;
      graph.localBindings[id] = edgeValue;
      changes.push({ path: id, to: edge, operation: "add" });
    }
  }

  if (domain === "state" || domain === "meta") {
    const store = domain === "state" ? graph.state : graph.meta;
    for (const entry of objectEntries(body)) {
      const target = targetPath(entry.key);
      if (!target) continue;
      const existing = store[target.subject]?.[target.key];
      if (existing !== undefined) {
        runtimeError(context, `Cannot graft ${domain} "${target.path}" because it already exists.`);
        continue;
      }

      store[target.subject] ??= {};
      const value = evaluateV3Value(entry.value, { runtime: context, graph });
      store[target.subject][target.key] = value;
      changes.push({ path: target.path, to: value, operation: "add" });
    }
  }

  recordMutationEvent(context, graph, "graft", domain, changes);
}

function executeNetworkGraft(directive: DirectiveNode, context: V3RuntimeContext, network: V3NetworkInstance): void {
  const body = directive.body?.kind === "Object" ? directive.body : undefined;
  if (!body) return;

  const changes: V3MutationChange[] = [];
  const added: Record<string, string[]> = {};
  graftList(network.graphs, referenceArray(findEntryValue(body, "graphs")), "graphs", changes, added);
  graftList(network.bridges, referenceArray(findEntryValue(body, "bridges")), "bridges", changes, added);
  graftList(network.contexts, referenceArray(findEntryValue(body, "contexts")), "contexts", changes, added);
  graftList(network.hooks, referenceArray(findEntryValue(body, "hooks")), "hooks", changes, added);
  validateNetworkReferences(network, context);
  recordMutationEvent(context, network, "graft", "network", changes, { added });
}

function executeNetworkStateMetaGraft(
  directive: DirectiveNode,
  context: V3RuntimeContext,
  network: V3NetworkInstance,
  domain: "state" | "meta",
): void {
  const body = directive.body?.kind === "Object" ? directive.body : undefined;
  if (!body) return;
  const store = domain === "state" ? network.state : network.meta;
  const changes: V3MutationChange[] = [];
  for (const entry of objectEntries(body)) {
    const key = keyName(entry.key);
    if (!key || key === "target") continue;
    if (store[key] !== undefined) {
      runtimeError(context, `Cannot graft network ${domain} "${key}" because it already exists.`);
      continue;
    }
    const value = evaluateV3Value(entry.value, { runtime: context, network });
    store[key] = value;
    changes.push({ path: key, to: value, operation: "add" });
  }
  recordMutationEvent(context, network, "graft", domain, changes);
}

function graftList(
  current: string[],
  values: string[],
  key: string,
  changes: V3MutationChange[],
  added: Record<string, string[]>,
): void {
  for (const value of values) {
    if (current.includes(value)) continue;
    current.push(value);
    added[key] ??= [];
    added[key].push(value);
    changes.push({ path: `${key}.${value}`, to: value, operation: "add" });
  }
}


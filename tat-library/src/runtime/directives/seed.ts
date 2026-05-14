import type { BindingNode, DirectiveNode, TatNode } from "../../ast/nodes.js";
import type { V3GraphInstance, V3NetworkInstance, V3RuntimeContext } from "../context.js";
import { createNodeInstance, resolveSeedEdge } from "../graphInstance.js";
import { createGraph, initializeGraphRecord } from "../entities/graph/createGraph.js";
import { createNetwork, staticObjectValue } from "../entities/network/createNetwork.js";
import { arrayItems, findEntryValue, referenceValue } from "./mutationHelpers.js";

export function executeSeedBinding(
  binding: BindingNode,
  directive: DirectiveNode,
  context: V3RuntimeContext,
): V3GraphInstance | V3NetworkInstance {
  const domain = referenceValue(directive.args[0]) ?? "graph";
  if (domain === "network") {
    return executeNetworkSeedBinding(binding, directive, context);
  }
  return executeGraphSeedBinding(binding, directive, context);
}

function executeGraphSeedBinding(
  binding: BindingNode,
  directive: DirectiveNode,
  context: V3RuntimeContext,
): V3GraphInstance {
  const body = directive.body?.kind === "Object" ? directive.body : undefined;
  const root = body ? referenceValue(findEntryValue(body, "root")) ?? "" : "";
  const graph = createGraph(binding.name.name, root);

  if (!body) return graph;

  for (const nodeRef of arrayItems(findEntryValue(body, "node"))) {
    const nodeId = referenceValue(nodeRef);
    if (!nodeId) continue;

    const nodeValue = context.bindings[nodeId];
    if (nodeValue?.type === "nodeDefinition") {
      graph.nodes[nodeId] = createNodeInstance(nodeValue);
      graph.localBindings[nodeId] = nodeValue;
    }
  }

  for (const edgeRef of arrayItems(findEntryValue(body, "edge"))) {
    const edge = resolveSeedEdge(edgeRef, context);
    if (!edge) continue;

    graph.edges[edge.id] = edge;
  }

  initializeGraphRecord(graph.state, findEntryValue(body, "state"), context, graph);
  initializeGraphRecord(graph.meta, findEntryValue(body, "meta"), context, graph);

  const event = {
    type: "seed",
    graph: graph.id,
    root: graph.root,
  };
  graph.history.push(event);
  context.events.push(event);

  return graph;
}

function executeNetworkSeedBinding(
  binding: BindingNode,
  directive: DirectiveNode,
  context: V3RuntimeContext,
): V3NetworkInstance {
  const body = directive.body?.kind === "Object" ? directive.body : undefined;
  const network = createNetwork({
    id: binding.name.name,
    anchor: body ? referenceValue(findEntryValue(body, "anchor")) ?? "" : "",
    graphs: body ? referencesFrom(findEntryValue(body, "graphs")) : [],
    bridges: body ? referencesFrom(findEntryValue(body, "bridges")) : [],
    contexts: body ? referencesFrom(findEntryValue(body, "contexts")) : [],
    hooks: body ? referencesFrom(findEntryValue(body, "hooks")) : [],
    state: body ? staticObjectValue(findEntryValue(body, "state")) : {},
    meta: body ? staticObjectValue(findEntryValue(body, "meta")) : {},
  }, context);

  const event = {
    type: "seed",
    network: network.id,
    anchor: network.anchor,
    detail: {
      graphs: network.graphs,
      bridges: network.bridges,
      contexts: network.contexts,
      hooks: network.hooks,
    },
  };
  context.events.push(event);

  return network;
}

function referencesFrom(node: TatNode | undefined): string[] {
  return arrayItems(node).map((item) => referenceValue(item)).filter((value): value is string => Boolean(value));
}

import type { DirectiveNode } from "../../ast/nodes.js";
import type { V3GraphInstance, V3NetworkInstance } from "../context.js";
import { evaluateV3Value, type V3EvaluationContext, type V3PathResult, type V3TraversalResult } from "../evaluation/evaluateValue.js";
import { argName, findEntryValue, firstGraph, recordEvent, runtimeBindingValue } from "../evaluation/readHelpers.js";

export function evaluateTraverse(node: DirectiveNode, context: V3EvaluationContext): V3TraversalResult {
  const domain = argName(node.args[0]);
  if (domain === "network") return evaluateNetworkTraverse(node, context);
  return evaluateGraphTraverse(node, context);
}

function evaluateGraphTraverse(node: DirectiveNode, context: V3EvaluationContext): V3TraversalResult {
  const body = node.body?.kind === "Object" ? node.body : undefined;
  const targetName = body ? semanticStringValue(findEntryValue(body, "target"), context) : undefined;
  const graph = targetName ? context.runtime.graphs[targetName] : context.graph ?? firstGraph(context.runtime);

  if (!graph || !body) return { has: false, count: undefined, paths: [] };

  const from = semanticStringValue(findEntryValue(body, "from"), context);
  const to = semanticStringValue(findEntryValue(body, "to"), context);
  const through = semanticStringValue(findEntryValue(body, "through"), context);
  const depth = numberValue(findEntryValue(body, "depth"), context) ?? 1;
  const limit = numberValue(findEntryValue(body, "limit"), context) ?? 10;
  const returnMode = stringValue(findEntryValue(body, "return"), context) ?? "first";

  const paths = from && to ? findGraphPaths(graph, from, to, { through, depth, limit, returnMode }) : [];
  const result: V3TraversalResult = {
    has: paths.length > 0,
    count: paths.length,
    paths,
  };

  recordEvent(context, {
    type: "traverse",
    graph: graph.id,
    detail: { from, to, through, depth, limit, result: result.has },
  });

  return result;
}

function evaluateNetworkTraverse(node: DirectiveNode, context: V3EvaluationContext): V3TraversalResult {
  const body = node.body?.kind === "Object" ? node.body : undefined;
  const targetName = body ? semanticStringValue(findEntryValue(body, "target"), context) : undefined;
  const network = targetName ? context.runtime.networks[targetName] : context.network;
  if (!network || !body) return { has: false, count: undefined, paths: [] };

  const from = semanticStringValue(findEntryValue(body, "from"), context);
  const to = semanticStringValue(findEntryValue(body, "to"), context);
  const through = semanticStringValue(findEntryValue(body, "through"), context);
  const depth = numberValue(findEntryValue(body, "depth"), context) ?? 1;
  const limit = numberValue(findEntryValue(body, "limit"), context) ?? 10;
  const returnMode = stringValue(findEntryValue(body, "return"), context) ?? "first";

  const paths = from && to ? findNetworkPaths(network, context, from, to, { through, depth, limit, returnMode }) : [];
  const result: V3TraversalResult = {
    has: paths.length > 0,
    count: paths.length,
    paths,
  };

  recordEvent(context, {
    type: "traverse",
    network: network.id,
    detail: { from, to, through, depth, limit, result: result.has },
  });

  return result;
}

function findGraphPaths(
  graph: V3GraphInstance,
  from: string,
  to: string,
  options: { through?: string; depth: number; limit: number; returnMode: string },
): V3PathResult[] {
  const results: V3PathResult[] = [];
  const queue: V3PathResult[] = [{ nodes: [from], edges: [] }];

  while (queue.length > 0 && results.length < options.limit) {
    const current = queue.shift();
    if (!current) break;

    const node = current.nodes[current.nodes.length - 1];
    if (node === to && current.edges.length > 0) {
      results.push(current);
      if (options.returnMode === "first") break;
      continue;
    }

    if (current.edges.length >= options.depth) continue;

    for (const edge of Object.values(graph.edges)) {
      if (edge.from !== node) continue;
      if (options.through && edge.relation !== options.through) continue;
      if (current.edges.includes(edge.id)) continue;
      if (current.nodes.includes(edge.to)) continue;

      queue.push({
        nodes: [...current.nodes, edge.to],
        edges: [...current.edges, edge.id],
      });
    }
  }

  return results;
}

function findNetworkPaths(
  network: V3NetworkInstance,
  context: V3EvaluationContext,
  from: string,
  to: string,
  options: { through?: string; depth: number; limit: number; returnMode: string },
): V3PathResult[] {
  const results: V3PathResult[] = [];
  const queue: V3PathResult[] = [{ nodes: [from], edges: [] }];
  while (queue.length > 0 && results.length < options.limit) {
    const current = queue.shift();
    if (!current) break;
    const graph = current.nodes[current.nodes.length - 1];
    if (graph === to && current.edges.length > 0) {
      results.push(current);
      if (options.returnMode === "first") break;
      continue;
    }
    if (current.edges.length >= options.depth) continue;
    for (const bridgeId of network.bridges) {
      const bridge = context.runtime.bridges[bridgeId];
      if (!bridge || bridge.from !== graph) continue;
      if (options.through && bridge.id !== options.through && bridge.context !== options.through) continue;
      if (current.edges.includes(bridge.id)) continue;
      if (current.nodes.includes(bridge.to)) continue;
      queue.push({ nodes: [...current.nodes, bridge.to], edges: [...current.edges, bridge.id] });
    }
  }
  return results;
}

function stringValue(node: Parameters<typeof evaluateV3Value>[0] | undefined, context: V3EvaluationContext): string | undefined {
  const value = node ? evaluateV3Value(node, context) : undefined;
  return value === undefined || value === null ? undefined : String(value);
}

function semanticStringValue(node: Parameters<typeof evaluateV3Value>[0] | undefined, context: V3EvaluationContext): string | undefined {
  if (!node) return undefined;
  if (node.kind === "Identifier") {
    const binding = context.runtime.bindings[node.name];
    const value = binding ? runtimeBindingValue(binding) : undefined;
    return typeof value === "string" ? value : node.name;
  }
  if (node.kind === "Path") return node.parts.map((part) => part.name).join(".");
  return stringValue(node, context);
}

function numberValue(node: Parameters<typeof evaluateV3Value>[0] | undefined, context: V3EvaluationContext): number | undefined {
  const value = node ? evaluateV3Value(node, context) : undefined;
  return typeof value === "number" ? value : undefined;
}

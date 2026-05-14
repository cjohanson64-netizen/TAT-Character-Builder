import type { DirectiveNode, ObjectNode } from "../../ast/nodes.js";
import type { V3EdgeInstance, V3GraphInstance, V3NetworkInstance } from "../context.js";
import { evaluateV3Value, type V3EvaluationContext, type V3QueryResult } from "../evaluation/evaluateValue.js";
import {
  argName,
  edgeProperty,
  firstGraph,
  keyName,
  matchesExpected,
  readProperty,
  recordEvent,
  runtimeBindingValue,
} from "../evaluation/readHelpers.js";

export function evaluateQuery(node: DirectiveNode, context: V3EvaluationContext): V3QueryResult {
  const domain = argName(node.args[0]) ?? "unknown";
  const condition = node.body?.kind === "Object" ? evaluateQueryCondition(node.body, context) : {};

  const targetName = typeof condition.target === "string" ? condition.target : undefined;

  const graph =
    domain === "state" || domain === "meta"
      ? context.graph ?? firstGraph(context.runtime)
      : targetName
        ? context.runtime.graphs[targetName]
        : context.graph ?? firstGraph(context.runtime);

  const network =
    domain === "state" || domain === "meta"
      ? context.network
      : targetName
        ? context.runtime.networks[targetName]
        : context.network;

  const normalizedCondition =
    (domain === "state" || domain === "meta") && condition.node === undefined && targetName
      ? { ...condition, node: targetName }
      : condition;

  const matches = queryMatches(domain, normalizedCondition, graph, network);

  const result: V3QueryResult = {
    result: matches.length > 0,
    domain,
    condition: normalizedCondition,
    matches,
  };

  recordEvent(context, {
    type: "query",
    ...(domain === "network" ? { network: network?.id } : { graph: graph?.id }),
    detail: {
      domain,
      result: result.result,
      condition: normalizedCondition,
    },
  });

  return result;
}

function evaluateQueryCondition(node: ObjectNode, context: V3EvaluationContext): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const semanticReferenceKeys = new Set(["id", "node", "from", "to", "relation", "key", "target", "anchor"]);
  const semanticReferenceArrayKeys = new Set(["graphs", "bridges", "contexts", "hooks"]);

  for (const entry of node.entries) {
    if (entry.kind !== "ObjectEntry") continue;

    const key = keyName(entry.key);
    if (!key) continue;

    result[key] = semanticReferenceArrayKeys.has(key)
      ? semanticStringArrayValue(entry.value, context)
      : semanticReferenceKeys.has(key)
        ? semanticStringValue(entry.value, context)
        : evaluateV3Value(entry.value, context);
  }

  return result;
}

function queryMatches(
  domain: string,
  condition: Record<string, unknown>,
  graph: V3GraphInstance | undefined,
  network: V3NetworkInstance | undefined,
): unknown[] {
  if (domain === "network") {
    if (!network) return [];
    return networkMatches(network, condition) ? [network] : [];
  }

  if (!graph && (domain === "node" || domain === "edge" || domain === "graph")) return [];

  if (domain === "node" && graph) {
    return Object.values(graph.nodes).filter((node) =>
      Object.entries(condition).filter(([key]) => key !== "target").every(([key, value]) => node.data[key] === value),
    );
  }

  if (domain === "edge" && graph) {
    return Object.values(graph.edges).filter((edge) =>
      Object.entries(condition).filter(([key]) => key !== "target").every(([key, value]) => edgeProperty(edge, key) === value),
    );
  }

  if (domain === "state" || domain === "meta") {
    const networkTarget = network ?? (typeof condition.target === "string" ? undefined : undefined);
    if (networkTarget) return queryNetworkStateMeta(domain, condition, networkTarget);
    if (!graph) return [];
    return queryGraphStateMeta(domain, condition, graph);
  }

  if (domain === "graph" && graph) {
    return Object.entries(condition).filter(([key]) => key !== "target").every(([key, value]) => readProperty(graph, key) === value) ? [graph] : [];
  }

  if (domain === "value") {
    const value = condition.value;
    const equals = condition.equals;
    return equals === undefined || value === equals ? [value] : [];
  }

  return [];
}

function networkMatches(network: V3NetworkInstance, condition: Record<string, unknown>): boolean {
  if (condition.anchor !== undefined && network.anchor !== condition.anchor) return false;
  return collectionMatches(network.graphs, condition.graphs)
    && collectionMatches(network.bridges, condition.bridges)
    && collectionMatches(network.contexts, condition.contexts)
    && collectionMatches(network.hooks, condition.hooks);
}

function collectionMatches(actual: string[], expected: unknown): boolean {
  if (expected === undefined) return true;
  if (Array.isArray(expected)) return expected.every((item) => actual.includes(String(item)));
  return actual.includes(String(expected));
}

function queryGraphStateMeta(domain: string, condition: Record<string, unknown>, graph: V3GraphInstance): unknown[] {
  const store = domain === "state" ? graph.state : graph.meta;
  const node = condition.node;
  const key = condition.key;
  const expected = condition.value;
  if (typeof node === "string" && key === undefined) {
    return store[node] && Object.keys(store[node]).length > 0 ? [{ node, values: store[node] }] : [];
  }
  if (typeof node !== "string" || typeof key !== "string") {
    return Object.entries(store).flatMap(([nodeId, values]) =>
      Object.entries(values).map(([valueKey, value]) => ({ node: nodeId, key: valueKey, value })),
    );
  }
  const actual = store[node]?.[key];
  if (expected === undefined || matchesExpected(actual, expected)) {
    return actual === undefined ? [] : [{ node, key, value: actual }];
  }
  return [];
}

function queryNetworkStateMeta(domain: string, condition: Record<string, unknown>, network: V3NetworkInstance): unknown[] {
  const store = domain === "state" ? network.state : network.meta;
  const key = condition.key;
  const expected = condition.value;
  if (typeof key !== "string") return Object.entries(store).map(([key, value]) => ({ key, value }));
  const actual = store[key];
  if (expected === undefined || matchesExpected(actual, expected)) {
    return actual === undefined ? [] : [{ key, value: actual }];
  }
  return [];
}

function semanticStringValue(node: Parameters<typeof evaluateV3Value>[0] | undefined, context: V3EvaluationContext): string | undefined {
  if (!node) return undefined;
  if (node.kind === "Identifier") {
    const binding = context.runtime.bindings[node.name];
    const value = binding ? runtimeBindingValue(binding) : undefined;
    return typeof value === "string" ? value : node.name;
  }
  if (node.kind === "Path") return node.parts.map((part) => part.name).join(".");
  const value = evaluateV3Value(node, context);
  return value === undefined || value === null ? undefined : String(value);
}

function semanticStringArrayValue(node: Parameters<typeof evaluateV3Value>[0] | undefined, context: V3EvaluationContext): string[] {
  if (!node) return [];
  if (node.kind === "Array") {
    return node.items.map((item) => semanticStringValue(item, context)).filter((value): value is string => Boolean(value));
  }
  const value = semanticStringValue(node, context);
  return value ? [value] : [];
}

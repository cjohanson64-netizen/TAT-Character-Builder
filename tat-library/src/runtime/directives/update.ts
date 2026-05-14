import type { AssignmentNode, DirectiveNode } from "../../ast/nodes.js";
import type { V3FlowTarget, V3GraphInstance, V3MutationChange, V3NetworkInstance, V3RuntimeContext } from "../context.js";
import { evaluateV3Value } from "../evaluation/evaluateValue.js";
import { runtimeError } from "../events.js";
import { validateNetworkReferences } from "../entities/network/createNetwork.js";
import {
  assignmentTargetPath,
  directiveDomain,
  isMutableEdgeField,
  keyName,
  recordMutationEvent,
  referenceValue,
  resolveTargetAlias,
} from "./mutationHelpers.js";

export function executeUpdate(directive: DirectiveNode, context: V3RuntimeContext, target: V3FlowTarget): void {
  const domain = directiveDomain(directive);
  if (domain === "network" && target.type === "network") {
    executeNetworkUpdate(directive, context, target);
    return;
  }
  if (target.type === "graph") {
    executeGraphUpdate(directive, context, target);
    return;
  }
  if (domain === "state" || domain === "meta") {
    executeNetworkStateMetaUpdate(directive, context, target, domain);
  }
}

function executeGraphUpdate(directive: DirectiveNode, context: V3RuntimeContext, graph: V3GraphInstance): void {
  const domain = directiveDomain(directive);
  const body = directive.body?.kind === "Object" ? directive.body : undefined;
  if (!domain || !body) return;

  const changes: V3MutationChange[] = [];

  for (const assignment of body.entries.filter((entry): entry is AssignmentNode => entry.kind === "Assignment")) {
    const target = resolveTargetAlias(assignmentTargetPath(assignment), context);
    if (!target) continue;

    const value = evaluateV3Value(assignment.value, { runtime: context, graph });

    if (domain === "state" || domain === "meta") {
      const store = domain === "state" ? graph.state : graph.meta;
      if (store[target.subject]?.[target.key] === undefined) {
        runtimeError(context, `Cannot update missing ${domain} "${target.path}".`);
        continue;
      }
      const previous = store[target.subject][target.key];
      store[target.subject][target.key] = value;
      changes.push({ path: target.path, from: previous, to: value, operation: "update" });
      continue;
    }

    if (domain === "node") {
      const node = graph.nodes[target.subject];
      if (!node || !(target.key in node.data)) {
        runtimeError(context, `Cannot update missing node value "${target.path}".`);
        continue;
      }
      const previous = node.data[target.key];
      node.data[target.key] = value;
      changes.push({ path: target.path, from: previous, to: value, operation: "update" });
      continue;
    }

    if (domain === "edge") {
      const edge = graph.edges[target.subject];
      if (!edge || !isMutableEdgeField(target.key)) {
        runtimeError(context, `Cannot update missing edge value "${target.path}".`);
        continue;
      }
      const previous = edge[target.key];
      edge[target.key] = value === undefined ? "" : String(value);
      changes.push({ path: target.path, from: previous, to: edge[target.key], operation: "update" });
    }
  }

  recordMutationEvent(context, graph, "update", domain, changes);
}

function executeNetworkUpdate(directive: DirectiveNode, context: V3RuntimeContext, network: V3NetworkInstance): void {
  const body = directive.body?.kind === "Object" ? directive.body : undefined;
  if (!body) return;
  const changes: V3MutationChange[] = [];
  for (const entry of body.entries) {
    if (entry.kind !== "Assignment" || entry.target.kind !== "Identifier") continue;
    if (entry.target.name !== "anchor") continue;
    const previous = network.anchor;
    const value = referenceValue(entry.value) ?? String(evaluateV3Value(entry.value, { runtime: context, network }) ?? "");
    network.anchor = value;
    changes.push({ path: "anchor", from: previous, to: network.anchor, operation: "update" });
  }
  validateNetworkReferences(network, context);
  recordMutationEvent(context, network, "update", "network", changes);
}

function executeNetworkStateMetaUpdate(
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
    if (entry.kind !== "Assignment") continue;
    const key = entry.target.kind === "Identifier" ? entry.target.name : entry.target.parts.map((part) => part.name).join(".");
    if (key === "target") continue;
    if (store[key] === undefined) {
      runtimeError(context, `Cannot update missing network ${domain} "${key}".`);
      continue;
    }
    const previous = store[key];
    const value = evaluateV3Value(entry.value, { runtime: context, network });
    store[key] = value;
    changes.push({ path: key, from: previous, to: value, operation: "update" });
  }
  recordMutationEvent(context, network, "update", domain, changes);
}

import type {
  IdentifierNode,
  LiteralNode,
  NodeDefinitionNode,
  ObjectEntryNode,
  ObjectNode,
  PathNode,
  RelationshipNode,
  TatNode,
} from "../ast/nodes.js";
import type {
  V3BridgeInstance,
  V3EdgeDefinitionValue,
  V3EdgeInstance,
  V3NodeDefinitionValue,
  V3NodeInstance,
  V3PrimitiveValue,
  V3RuntimeContext,
} from "./context.js";

export type { V3BridgeInstance, V3EdgeInstance, V3GraphInstance, V3NodeInstance } from "./context.js";

export function createNodeDefinitionValue(
  bindingName: string,
  node: NodeDefinitionNode,
): V3NodeDefinitionValue {
  const data = objectToRecord(node.body);
  const id = valueToRuntime(data.id) ?? bindingName;

  return {
    type: "nodeDefinition",
    id: String(id),
    entityType: node.entityType,
    data,
    node,
  };
}

export function createNodeInstance(value: V3NodeDefinitionValue): V3NodeInstance {
  return {
    id: value.id,
    data: { ...value.data },
  };
}


export function createBridgeInstance(
  bindingName: string,
  node: import("../ast/nodes.js").BridgeDefinitionNode,
): V3BridgeInstance {
  const data = objectToRecord(node.body);
  const id = valueToRuntime(data.id) ?? bindingName;
  const hooks = Array.isArray(data.hooks) ? data.hooks.map(String) : [];
  return {
    type: "bridge",
    id: String(id),
    from: data.from === undefined ? "" : String(data.from),
    to: data.to === undefined ? "" : String(data.to),
    context: data.context === undefined ? undefined : String(data.context),
    hooks,
    state: isRecord(data.state) ? { ...data.state } : {},
    meta: isRecord(data.meta) ? { ...data.meta } : {},
    node,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createEdgeDefinitionValue(
  id: string,
  relationship: RelationshipNode,
): V3EdgeDefinitionValue {
  if (relationship.relationshipKind !== "edge") {
    return {
      type: "edgeDefinition",
      id,
      from: "",
      to: "",
      explicit: false,
      node: relationship,
    };
  }

  if (relationship.explicit) {
    return {
      type: "edgeDefinition",
      id,
      from: referenceValue(relationship.from) ?? "",
      relation: valueToString(relationship.relation),
      to: referenceValue(relationship.to) ?? "",
      explicit: true,
      node: relationship,
    };
  }

  return {
    type: "edgeDefinition",
    id,
    from: referenceValue(relationship.from) ?? "",
    to: referenceValue(relationship.to) ?? "",
    explicit: false,
    node: relationship,
  };
}

export function resolveSeedEdge(node: TatNode, context: V3RuntimeContext): V3EdgeInstance | undefined {
  if (node.kind === "Identifier") {
    const value = context.bindings[node.name];
    if (value?.type === "edgeDefinition") {
      return edgeDefinitionToInstance(value);
    }
  }

  if (node.kind === "Relationship" && node.relationshipKind === "edge") {
    return edgeDefinitionToInstance(createEdgeDefinitionValue(`edge${Object.keys(context.bindings).length}`, node));
  }

  return undefined;
}

export function edgeDefinitionToInstance(value: V3EdgeDefinitionValue): V3EdgeInstance {
  return {
    id: value.id,
    from: value.from,
    relation: value.relation,
    to: value.to,
    explicit: value.explicit,
  };
}

function objectToRecord(object: ObjectNode): Record<string, unknown> {
  const record: Record<string, unknown> = {};

  for (const entry of object.entries) {
    if (entry.kind !== "ObjectEntry") continue;

    const key = keyName(entry.key);
    if (!key) continue;

    record[key] = evaluateStaticValue(entry.value);
  }

  return record;
}

function evaluateStaticValue(node: TatNode): unknown {
  if (node.kind === "Literal") return literalValue(node);
  if (node.kind === "Identifier") return node.name;
  if (node.kind === "Path") return node.parts.map((part) => part.name).join(".");
  if (node.kind === "Array") return node.items.map((item) => evaluateStaticValue(item));
  if (node.kind === "Object") return objectToRecord(node);

  return {
    type: "unresolved",
    kind: node.kind,
  };
}

function keyName(key: IdentifierNode | PathNode | LiteralNode): string | undefined {
  if (key.kind === "Identifier") return key.name;
  if (key.kind === "Path") return key.parts.map((part) => part.name).join(".");
  if (key.literalKind === "string") return key.value;
  return undefined;
}

function referenceValue(node: TatNode | IdentifierNode | PathNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.kind === "Identifier") return node.name;
  if (node.kind === "Path") return node.parts.map((part) => part.name).join(".");
  return undefined;
}

function literalValue(node: LiteralNode): V3PrimitiveValue {
  return node.value;
}

function valueToString(node: IdentifierNode | LiteralNode): string | undefined {
  if (node.kind === "Identifier") return node.name;
  const value = literalValue(node);
  return value === null ? undefined : String(value);
}

function valueToRuntime(value: unknown): V3PrimitiveValue | undefined {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  return undefined;
}

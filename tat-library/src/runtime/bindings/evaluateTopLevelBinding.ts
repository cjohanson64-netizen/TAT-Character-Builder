import type { BindingNode, FlowBodyNode, IdentifierNode, LiteralNode, ObjectEntryNode, ObjectNode, PathNode, TatNode } from "../../ast/nodes.js";
import {
  createBridgeInstance,
  createEdgeDefinitionValue,
  createNodeDefinitionValue,
} from "../graphInstance.js";
import type { V3PrimitiveValue, V3RuntimeValue } from "../context.js";

function isActionBodyNode(node: TatNode | undefined): node is FlowBodyNode | ObjectNode {
  return node?.kind === "FlowBody" || node?.kind === "Object";
}

export function evaluateTopLevelBinding(binding: BindingNode): V3RuntimeValue {
  const value = binding.value;

  if (value.kind === "NodeDefinition") {
    return createNodeDefinitionValue(binding.name.name, value);
  }

  if (value.kind === "BridgeDefinition") {
    return createBridgeInstance(binding.name.name, value);
  }

  if (value.kind === "Relationship" && value.relationshipKind === "edge") {
    return createEdgeDefinitionValue(binding.name.name, value);
  }

  if (value.kind === "Directive" && (value.name === "action" || value.name === "project")) {
    const objectBody = value.body?.kind === "Object" ? value.body : undefined;
    const actionBody = value.name === "action" ? actionFlowBody(value.body) : value.body;
    return {
      type: "constructor",
      constructorKind: value.name === "action" ? "action" : "projection",
      name: binding.name.name,
      params: value.name === "action" && objectBody
        ? paramsFromObjectBody(objectBody)
        : value.args.map((arg) => referenceValue(arg)).filter((name): name is string => Boolean(name)),
      body: isActionBodyNode(actionBody) ? actionBody : undefined,
      node: value,
    };
  }

  if (value.kind === "Literal") {
    return {
      type: "primitive",
      value: literalValue(value),
      node: value,
    };
  }

  return {
    type: "unknown",
    node: value,
  };
}

function actionFlowBody(body: TatNode | undefined): FlowBodyNode | typeof body {
  if (body?.kind === "FlowBody") return body;
  if (body?.kind !== "Object") return body;
  const action = findEntryValue(body, "action");
  return action?.kind === "FlowBody" ? action : body;
}

function paramsFromObjectBody(body: ObjectNode): string[] {
  const params = findEntryValue(body, "params");
  if (params?.kind !== "Array") return [];
  return params.items.map((item) => referenceValue(item)).filter((name): name is string => Boolean(name));
}

function findEntryValue(object: ObjectNode, key: string): TatNode | undefined {
  return object.entries.find(
    (entry): entry is ObjectEntryNode => entry.kind === "ObjectEntry" && referenceValue(entry.key) === key,
  )?.value;
}

function referenceValue(node: TatNode | IdentifierNode | PathNode | undefined): string | undefined {
  if (!node) return undefined;
  if (node.kind === "Identifier") return node.name;
  if (node.kind === "Path") return node.parts.map((part) => part.name).join(".");
  if (node.kind === "Literal") return valueToString(node);
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

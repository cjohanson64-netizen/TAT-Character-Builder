import type {
  ArrayNode,
  DirectiveNode,
  ExpressionNode,
  FunctionCallExpressionNode,
  IdentifierNode,
  InvocationNode,
  LiteralNode,
  ObjectNode,
  PathNode,
  TatNode,
} from "../../ast/nodes.js";
import type {
  V3GraphInstance,
  V3NetworkInstance,
  V3RuntimeContext,
  V3RuntimeDiagnostic,
} from "../context.js";
import { evaluateMatch } from "../directives/match.js";
import { evaluateQuery } from "../directives/query.js";
import { evaluateTraverse } from "../directives/traverse.js";
import {
  compareValues,
  firstGraph,
  keyName,
  readProperty,
  runtimeBindingValue,
  toNumber,
} from "./readHelpers.js";

export interface V3EvaluationContext {
  runtime: V3RuntimeContext;
  graph?: V3GraphInstance;
  network?: V3NetworkInstance;
}

export interface V3QueryResult {
  result: boolean;
  domain: string;
  condition: Record<string, unknown>;
  matches?: unknown[];
}

export interface V3PathResult {
  nodes: string[];
  edges: string[];
}

export interface V3TraversalResult {
  has: boolean;
  count: number | undefined;
  paths: V3PathResult[];
}

export interface V3MatchResult {
  domain: string;
  items: unknown[];
  count: number;
}

export function evaluateV3Value(
  node: TatNode,
  context: V3EvaluationContext,
): unknown {
  switch (node.kind) {
    case "Identifier":
      return evaluateIdentifier(node, context);
    case "Literal":
      return node.value;
    case "Path":
      return resolvePath(node, context);
    case "Array":
      return node.items.map((item) => evaluateV3Value(item, context));
    case "Object":
      return evaluateObject(node, context);
    case "Expression":
      return evaluateExpression(node, context);
    case "Directive":
      return evaluateReadDirective(node, context);
    case "Invocation":
      return evaluateInvocation(node, context);
    default:
      return undefined;
  }
}

export function evaluateReadDirective(
  node: DirectiveNode,
  context: V3EvaluationContext,
): unknown {
  if (node.name === "derive") {
    const body = node.body?.kind === "Object" ? node.body : undefined;
    const formula = body
      ? (findObjectEntryValue(body, "formula") ??
        findObjectEntryValue(body, "value"))
      : undefined;
    return formula
      ? evaluateV3Value(formula, context)
      : node.args[0]
        ? evaluateV3Value(node.args[0], context)
        : undefined;
  }

  if (node.name === "query") {
    return evaluateQuery(node, context);
  }

  if (node.name === "traverse") {
    return evaluateTraverse(node, context);
  }

  if (node.name === "match") {
    return evaluateMatch(node, context);
  }

  return undefined;
}

export function resolvePath(
  node: PathNode,
  context: V3EvaluationContext,
): unknown {
  const [head, ...rest] = node.parts.map((part) => part.name);
  const graph = context.graph ?? firstGraph(context.runtime);

  if (!head) return undefined;

  if (graph && rest.length > 0) {
    const key = rest.join(".");

    if (graph.state[head] && key in graph.state[head]) {
      return graph.state[head][key];
    }

    if (graph.meta[head] && key in graph.meta[head]) {
      return graph.meta[head][key];
    }

    if (graph.nodes[head] && key in graph.nodes[head].data) {
      return graph.nodes[head].data[key];
    }
  }

  const binding = context.runtime.bindings[head];
  if (binding) {
    const value = runtimeBindingValue(binding);
    if (
      graph &&
      rest.length > 0 &&
      typeof value === "string" &&
      graph.nodes[value]
    ) {
      const key = rest.join(".");
      if (graph.state[value] && key in graph.state[value])
        return graph.state[value][key];
      if (graph.meta[value] && key in graph.meta[value])
        return graph.meta[value][key];
      if (key in graph.nodes[value].data) return graph.nodes[value].data[key];
    }
    return rest.reduce<unknown>(
      (current, part) => readProperty(current, part),
      value,
    );
  }

  if (head === "state" && graph && rest.length > 0) {
    return readProperty(graph.state, rest.join("."));
  }

  if (head === "state" && context.network && rest.length > 0) {
    return readProperty(context.network.state, rest.join("."));
  }

  if (head === "meta" && graph && rest.length > 0) {
    return readProperty(graph.meta, rest.join("."));
  }

  if (head === "meta" && context.network && rest.length > 0) {
    return readProperty(context.network.meta, rest.join("."));
  }

  if (head === "network" && context.network && rest.length > 0) {
    return readProperty(context.network, rest.join("."));
  }

  return node.parts.map((part) => part.name).join(".");
}

function evaluateIdentifier(
  node: IdentifierNode,
  context: V3EvaluationContext,
): unknown {
  const binding = context.runtime.bindings[node.name];
  if (binding) return runtimeBindingValue(binding);
  return node.name;
}

function evaluateObject(
  node: ObjectNode,
  context: V3EvaluationContext,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const entry of node.entries) {
    if (entry.kind !== "ObjectEntry") continue;
    const key = keyName(entry.key);
    if (key) result[key] = evaluateV3Value(entry.value, context);
  }
  return result;
}

function findObjectEntryValue(
  node: ObjectNode,
  key: string,
): TatNode | undefined {
  for (const entry of node.entries) {
    if (entry.kind !== "ObjectEntry") continue;
    const entryKey = keyName(entry.key);
    if (entryKey === key) return entry.value;
  }
  return undefined;
}

function evaluateExpression(
  node: ExpressionNode,
  context: V3EvaluationContext,
): unknown {
  if (node.expressionKind === "binary") {
    const left = evaluateV3Value(node.left, context);
    const right = evaluateV3Value(node.right, context);
    return applyBinary(node.operator, left, right);
  }

  if (node.expressionKind === "comparison") {
    const right = evaluateV3Value(node.right, context);
    if (!node.left) {
      return {
        comparator: node.operator,
        right,
      };
    }

    return compareValues(
      evaluateV3Value(node.left, context),
      node.operator,
      right,
    );
  }

  if (node.expressionKind === "unary") {
    const value = evaluateV3Value(node.value, context);
    return node.operator === "!" ? !value : -toNumber(value);
  }

  if (node.expressionKind === "ternary") {
    return evaluateV3Value(node.condition, context)
      ? evaluateV3Value(node.whenTrue, context)
      : evaluateV3Value(node.whenFalse, context);
  }

  return evaluateFunctionCall(node, context);
}

function evaluateInvocation(
  node: InvocationNode,
  context: V3EvaluationContext,
): unknown {
  if (node.callee.kind !== "Identifier") return undefined;
  return evaluateFunctionLike(node.callee.name, node.args, context);
}

function evaluateFunctionCall(
  node: FunctionCallExpressionNode,
  context: V3EvaluationContext,
): unknown {
  return evaluateFunctionLike(node.name.name, node.args, context);
}

function evaluateFunctionLike(
  name: string,
  args: TatNode[],
  context: V3EvaluationContext,
): unknown {
  const values = args.map((arg) => evaluateV3Value(arg, context));
  const flatValues =
    values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  const numbers = flatValues.map((value) => toNumber(value));

  switch (name) {
    case "min":
      return Math.min(...numbers);
    case "max":
      return Math.max(...numbers);
    case "abs":
      return Math.abs(numbers[0] ?? 0);
    case "round":
      return Math.round(numbers[0] ?? 0);
    case "floor":
      return Math.floor(numbers[0] ?? 0);
    case "ceil":
      return Math.ceil(numbers[0] ?? 0);
    case "clamp": {
      const [value, min, max] = numbers;
      return Math.min(Math.max(value ?? 0, min ?? 0), max ?? value ?? 0);
    }
    case "sum":
      return numbers.reduce((sum, value) => sum + value, 0);
    case "avg":
      return numbers.length === 0
        ? 0
        : numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    default:
      context.runtime.diagnostics.push({
        severity: "error",
        message: `Unknown compute function "${name}".`,
      });
      return undefined;
  }
}

function applyBinary(operator: string, left: unknown, right: unknown): unknown {
  if (operator === "+") {
    if (typeof left === "string" || typeof right === "string")
      return `${left ?? ""}${right ?? ""}`;
    return toNumber(left) + toNumber(right);
  }
  if (operator === "-") return toNumber(left) - toNumber(right);
  if (operator === "*") return toNumber(left) * toNumber(right);
  if (operator === "/") return toNumber(left) / toNumber(right);
  if (operator === "%") return toNumber(left) % toNumber(right);
  if (operator === "^") return toNumber(left) ** toNumber(right);
  if (operator === "&&") return Boolean(left) && Boolean(right);
  if (operator === "||") return Boolean(left) || Boolean(right);
  if (operator === "in")
    return Array.isArray(right) ? right.includes(left) : false;
  return undefined;
}

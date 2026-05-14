import type { Token } from "../lexer/tokens/types.js";
import type {
  DirectiveNode,
  FlowBodyNode,
  FlowStepNode,
  GateNode,
  InjectionFlowStepNode,
  InvocationNode,
  MutationFlowStepNode,
  ProjectionFlowStepNode,
  RelationshipNode,
  TatNode,
} from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";
import { parseExpression, type ExpressionParser } from "./parseExpression.js";
import { isFlowStepStartAt, isGateOperator, parseGate } from "./parseGate.js";
import { parseInvocationOnly, type InvocationParser } from "./parseInvocation.js";

export interface FlowParser extends ExpressionParser, InvocationParser {
  peekN(offset: number): Token;
  isAtEnd(): boolean;
  advance(): Token;
}

type FlowStepValue = DirectiveNode | InvocationNode | RelationshipNode;

export function parseFlow(parser: FlowParser): TatNode {
  const sourceNode = parseFlowSource(parser);

  if (!isFlowStepStart(parser)) {
    return sourceNode;
  }

  const steps: FlowStepNode[] = [];

  while (isFlowStepStart(parser)) {
    steps.push(parseFlowStep(parser));
  }

  return {
    kind: "Flow",
    sourceNode,
    steps,
    source: parser.spanFrom(sourceNode.source, steps[steps.length - 1]?.source),
  };
}

export function parseFlowSource(parser: FlowParser): TatNode {
  return parseExpression(parser);
}

export function parseFlowBody(parser: FlowParser): FlowBodyNode {
  const start = parser.consume("LeftBrace", "Expected '{' to start flow body.");
  const steps: FlowBodyNode["steps"] = [];

  while (!parser.check("RightBrace") && !parser.isAtEnd()) {
    steps.push(parseFlowStep(parser, "Expected flow step in flow body."));
    parser.match("Comma");
  }

  const end = parser.consume("RightBrace", "Expected '}' after flow body.");
  return {
    kind: "FlowBody",
    steps,
    source: parser.spanFrom(start, end),
  };
}

export function parseFlowStep(parser: FlowParser, projectionMessage = "Expected flow operator."): FlowStepNode {
  if (parser.match("MutationFlow")) {
    return parseMutationStep(parser);
  }

  if (parser.match("InjectionFlow")) {
    return parseInjectionStep(parser);
  }

  if (isGateOperator(parser)) {
    return parseGate(parser, () => isFlowStepStart(parser));
  }

  return parseProjectionStep(parser, projectionMessage);
}

export function parseMutationStep(parser: FlowParser): MutationFlowStepNode {
  const start = parser.previous();
  const value = parseMutationFlowValue(parser);
  return {
    kind: "FlowStep",
    operator: "->",
    value,
    source: parser.spanFrom(start, value.source),
  };
}

export function parseInjectionStep(parser: FlowParser): InjectionFlowStepNode {
  const start = parser.previous();
  const value = parser.parseDirective();
  return {
    kind: "FlowStep",
    operator: "<-",
    value,
    source: parser.spanFrom(start, value.source),
  };
}

export function parseProjectionStep(parser: FlowParser, message: string): ProjectionFlowStepNode {
  const start = parser.consume("ProjectionFlow", message);
  const value = parseProjectionFlowValue(parser);
  return {
    kind: "FlowStep",
    operator: "<>",
    value,
    source: parser.spanFrom(start, value.source),
  };
}

export function isFlowStepStart(parser: FlowParser): boolean {
  return isFlowOperator(parser) || isGateOperator(parser);
}

export function isFlowBodyStart(parser: FlowParser): boolean {
  return parser.check("LeftBrace") && isFlowStepStartAt((offset) => parser.peekN(offset), 1);
}

function parseMutationFlowValue(parser: FlowParser): FlowStepValue {
  if (parser.check("At")) {
    return parser.parseDirective();
  }

  if (parser.check("LeftBrace")) {
    return parser.parseEdgeRelationship();
  }

  return parseInvocationOnly(parser, "Expected invocation after '->'.");
}

function parseProjectionFlowValue(parser: FlowParser): DirectiveNode | InvocationNode {
  if (parser.check("At")) {
    return parser.parseDirective();
  }

  return parseInvocationOnly(parser, "Expected invocation after '<>'.");
}

function isFlowOperator(parser: FlowParser): boolean {
  return (
    parser.check("MutationFlow") ||
    parser.check("InjectionFlow") ||
    parser.check("ProjectionFlow")
  );
}

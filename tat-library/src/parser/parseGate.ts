import type { Token } from "../lexer/tokens/types.js";
import type { GateNode, TatNode } from "../ast/nodes.js";
import { parseExpression, type ExpressionParser } from "./parseExpression.js";

export interface GateParser extends ExpressionParser {
  advance(): Token;
  isAtEnd(): boolean;
}

export function parseGate(parser: GateParser, isFlowStepStart: () => boolean): GateNode {
  const start = parser.advance();
  const operator = gateOperatorFrom(start);
  const condition = shouldParseGateCondition(parser, isFlowStepStart) ? parseGateCondition(parser) : undefined;

  return {
    kind: "Gate",
    operator,
    condition,
    source: parser.spanFrom(start, condition?.source ?? start),
  };
}

export function parseGateCondition(parser: GateParser): TatNode {
  return parseExpression(parser);
}

export function isGateOperator(parser: Pick<GateParser, "check">): boolean {
  return (
    parser.check("ConditionalGate") ||
    parser.check("NegatedGate") ||
    parser.check("FallbackGate")
  );
}

export function isFlowStepStartAt(peekN: (offset: number) => Token, offset: number): boolean {
  const type = peekN(offset).type;
  return (
    type === "MutationFlow" ||
    type === "InjectionFlow" ||
    type === "ProjectionFlow" ||
    type === "ConditionalGate" ||
    type === "NegatedGate" ||
    type === "FallbackGate"
  );
}

function shouldParseGateCondition(parser: GateParser, isFlowStepStart: () => boolean): boolean {
  return (
    !parser.isAtEnd() &&
    !isFlowStepStart() &&
    !parser.check("Comma") &&
    !parser.check("RightBrace") &&
    !parser.check("RightBracket") &&
    !parser.check("RightParen") &&
    !parser.check("NodeBodyEnd")
  );
}

function gateOperatorFrom(token: Token): GateNode["operator"] {
  if (token.type === "ConditionalGate") return "?>";
  if (token.type === "NegatedGate") return "!>";
  return ":>";
}

import type { Token, TokenType } from "../lexer/tokens/types.js";
import type {
  FunctionCallExpressionNode,
  IdentifierNode,
  InvocationNode,
  PathNode,
  TatNode,
} from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";
import { ParseError } from "./errors.js";

type ReferenceNode = IdentifierNode | PathNode;

export interface InvocationParser {
  peek(): Token;
  check(type: TokenType): boolean;
  match(type: TokenType): boolean;
  consume(type: TokenType, message: string): Token;
  spanFrom(startInput: Token | SourceSpan | undefined, endInput: Token | SourceSpan | undefined): SourceSpan;
  parseReference(): ReferenceNode;
  parseValueExpression(): TatNode;
}

export interface CallArgsParser {
  check(type: TokenType): boolean;
  match(type: TokenType): boolean;
  parseValueExpression(): TatNode;
}

const FUNCTION_EXPRESSION_NAMES = new Set([
  "min",
  "max",
  "abs",
  "round",
  "floor",
  "ceil",
  "clamp",
  "avg",
  "sum",
]);

export function parseInvocationOnly(parser: InvocationParser, message: string): InvocationNode {
  const reference = parser.parseReference();
  if (!parser.match("LeftParen")) {
    throw new ParseError(message, parser.peek());
  }

  const call = finishCall(parser, reference);
  if (call.kind !== "Invocation") {
    throw new ParseError(message, parser.peek());
  }

  return call;
}

export function finishCall(
  parser: InvocationParser,
  callee: ReferenceNode,
): InvocationNode | FunctionCallExpressionNode {
  const args = parseCallArgs(parser, "RightParen");
  const end = parser.consume("RightParen", "Expected ')' after call arguments.");

  if (callee.kind === "Identifier" && FUNCTION_EXPRESSION_NAMES.has(callee.name)) {
    return {
      kind: "Expression",
      expressionKind: "functionCall",
      name: callee,
      args,
      source: parser.spanFrom(callee.source, end),
    } satisfies FunctionCallExpressionNode;
  }

  return {
    kind: "Invocation",
    callee,
    args,
    source: parser.spanFrom(callee.source, end),
  };
}

export function parseCallArgs(parser: CallArgsParser, endType: TokenType): TatNode[] {
  const args: TatNode[] = [];

  if (parser.check(endType)) return args;

  do {
    if (parser.check(endType)) break;
    args.push(parser.parseValueExpression());
  } while (parser.match("Comma"));

  return args;
}

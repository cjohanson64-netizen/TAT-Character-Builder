import type { Token, TokenType } from "../lexer/tokens/types.js";
import type { ArrayNode, TatNode } from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";

export interface ArrayParser {
  check(type: TokenType): boolean;
  match(type: TokenType): boolean;
  consume(type: TokenType, message: string): Token;
  spanFrom(startInput: Token | SourceSpan | undefined, endInput: Token | SourceSpan | undefined): SourceSpan;
  parseValueExpression(): TatNode;
}

export function parseArray(parser: ArrayParser): ArrayNode {
  const start = parser.consume("LeftBracket", "Expected '[' to start array.");
  const items = parseArrayItems(parser, "RightBracket");
  const end = parser.consume("RightBracket", "Expected ']' after array.");

  return {
    kind: "Array",
    items,
    source: parser.spanFrom(start, end),
  };
}

export function parseArrayItems(parser: ArrayParser, endType: TokenType): TatNode[] {
  const items: TatNode[] = [];

  if (parser.check(endType)) return items;

  do {
    if (parser.check(endType)) break;
    items.push(parser.parseValueExpression());
  } while (parser.match("Comma"));

  return items;
}

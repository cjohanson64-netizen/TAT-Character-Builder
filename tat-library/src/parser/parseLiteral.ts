import type { Token } from "../lexer/tokens/types.js";
import type { LiteralNode } from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";

export interface LiteralParser {
  advance(): Token;
  spanFrom(startInput: Token | SourceSpan | undefined, endInput: Token | SourceSpan | undefined): SourceSpan;
}

export function parseLiteral(parser: LiteralParser): LiteralNode {
  const token = parser.advance();

  if (token.type === "String") {
    return parseStringLiteral(parser, token);
  }

  if (token.type === "Number") {
    return parseNumberLiteral(parser, token);
  }

  if (token.type === "Boolean") {
    return parseBooleanLiteral(parser, token);
  }

  return parseNullLiteral(parser, token);
}

export function parseStringLiteral(parser: LiteralParser, token: Token): LiteralNode {
  return {
    kind: "Literal",
    literalKind: "string",
    value: parseStringValue(token.value),
    source: parser.spanFrom(token, token),
  };
}

export function parseNumberLiteral(parser: LiteralParser, token: Token): LiteralNode {
  return {
    kind: "Literal",
    literalKind: "number",
    value: Number(token.value),
    source: parser.spanFrom(token, token),
  };
}

export function parseBooleanLiteral(parser: LiteralParser, token: Token): LiteralNode {
  return {
    kind: "Literal",
    literalKind: "boolean",
    value: token.value === "true",
    source: parser.spanFrom(token, token),
  };
}

export function parseNullLiteral(parser: LiteralParser, token: Token): LiteralNode {
  return {
    kind: "Literal",
    literalKind: "null",
    value: null,
    source: parser.spanFrom(token, token),
  };
}

export function parseStringValue(value: string): string {
  if (value.length < 2) return value;
  const inner = value.slice(1, -1);
  return inner
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\\\/g, "\\");
}

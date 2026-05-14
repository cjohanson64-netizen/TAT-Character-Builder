import type { Token } from "../lexer/tokens/types.js";
import type { ExportNode, IdentifierNode, ImportNode, LiteralNode } from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";
import { ParseError } from "./errors.js";

export interface ModuleParser {
  check(type: "RightBrace"): boolean;
  match(type: "Comma"): boolean;
  consume(type: "Identifier" | "LeftBrace" | "RightBrace", message: string): Token;
  spanFrom(startInput: Token | SourceSpan | undefined, endInput: Token | SourceSpan | undefined): SourceSpan;
  tokenFromSpan(span: Token | SourceSpan): Token;
  parseIdentifier(): IdentifierNode;
  parseLiteral(): LiteralNode;
}

export function parseImport(parser: ModuleParser): ImportNode {
  const start = consumeKeyword(parser, "import", "Expected import.");
  parser.consume("LeftBrace", "Expected '{' after import.");
  const imports = parseIdentifierList(parser);
  parser.consume("RightBrace", "Expected '}' after import names.");
  consumeKeyword(parser, "from", "Expected 'from' after import names.");
  const from = parser.parseLiteral();
  if (from.literalKind !== "string") {
    throw new ParseError("Expected string module path after from.", parser.tokenFromSpan(from.source ?? start));
  }

  return {
    kind: "Import",
    imports,
    from,
    source: parser.spanFrom(start, from.source),
  };
}

export function parseExport(parser: ModuleParser): ExportNode {
  const start = consumeKeyword(parser, "export", "Expected export.");
  parser.consume("LeftBrace", "Expected '{' after export.");
  const names = parseIdentifierList(parser);
  const end = parser.consume("RightBrace", "Expected '}' after export names.");

  return {
    kind: "Export",
    names,
    source: parser.spanFrom(start, end),
  };
}

export function parseIdentifierList(parser: ModuleParser): IdentifierNode[] {
  const names: IdentifierNode[] = [];
  if (parser.check("RightBrace")) return names;

  do {
    names.push(parser.parseIdentifier());
  } while (parser.match("Comma") && !parser.check("RightBrace"));

  return names;
}

function consumeKeyword(parser: ModuleParser, value: string, message: string): Token {
  const token = parser.consume("Identifier", message);
  if (token.value !== value) {
    throw new ParseError(message, token);
  }
  return token;
}

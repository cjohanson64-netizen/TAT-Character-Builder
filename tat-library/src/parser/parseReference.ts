import type { Token } from "../lexer/tokens/types.js";
import type { IdentifierNode, PathNode } from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";

type ReferenceNode = IdentifierNode | PathNode;

export interface ReferenceParser {
  peek(): Token;
  match(type: "Dot"): boolean;
  consume(type: "Identifier", message: string): Token;
  spanFrom(startInput: Token | SourceSpan | undefined, endInput: Token | SourceSpan | undefined): SourceSpan;
}

export function parseReference(parser: ReferenceParser): ReferenceNode {
  const start = parser.peek();
  const parts = [parseIdentifier(parser)];

  while (parser.match("Dot")) {
    parts.push(parseIdentifier(parser));
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return parsePath(parser, start, parts);
}

export function parsePath(parser: ReferenceParser, start: Token, parts: IdentifierNode[]): PathNode {
  return {
    kind: "Path",
    parts,
    source: parser.spanFrom(start, parts[parts.length - 1].source),
  };
}

export function parseIdentifier(parser: ReferenceParser): IdentifierNode {
  const token = parser.consume("Identifier", "Expected identifier.");
  return {
    kind: "Identifier",
    name: token.value,
    source: parser.spanFrom(token, token),
  };
}

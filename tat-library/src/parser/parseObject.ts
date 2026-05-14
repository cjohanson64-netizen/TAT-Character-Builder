import type { Token, TokenType } from "../lexer/tokens/types.js";
import type {
  AssignmentNode,
  IdentifierNode,
  LiteralNode,
  ObjectEntryNode,
  ObjectMemberNode,
  ObjectNode,
  PathNode,
  TatNode,
} from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";
import { ParseError } from "./errors.js";

type ObjectKeyNode = IdentifierNode | PathNode | LiteralNode;
type ReferenceNode = IdentifierNode | PathNode;

export interface ObjectParser {
  peek(): Token;
  check(type: TokenType): boolean;
  match(type: TokenType): boolean;
  consume(type: TokenType, message: string): Token;
  isAtEnd(): boolean;
  tokenFromSpan(span: Token | SourceSpan): Token;
  spanFrom(startInput: Token | SourceSpan | undefined, endInput: Token | SourceSpan | undefined): SourceSpan;
  isAssignmentStart(): boolean;
  parseAssignment(): AssignmentNode;
  parseLiteral(): LiteralNode;
  parseReference(): ReferenceNode;
  parseValueExpression(): TatNode;
}

export function parseObject(parser: ObjectParser): ObjectNode {
  const start = parser.consume("LeftBrace", "Expected '{' to start object body.");
  const entries = parseObjectMembers(parser, "RightBrace", start);
  const end = parser.consume("RightBrace", "Expected '}' after object body.");

  return {
    kind: "Object",
    entries,
    source: parser.spanFrom(start, end),
  };
}

export function parseObjectMembers(
  parser: ObjectParser,
  endType: TokenType,
  start: Token | SourceSpan,
): ObjectMemberNode[] {
  const entries: ObjectMemberNode[] = [];

  while (!parser.check(endType) && !parser.isAtEnd()) {
    entries.push(parseObjectMember(parser));

    if (!parser.match("Comma")) {
      if (!parser.check(endType)) {
        throw new ParseError("Expected ',' between object entries.", parser.peek());
      }
      break;
    }

    if (parser.check(endType)) break;
  }

  if (parser.isAtEnd() && endType !== "EOF") {
    throw new ParseError("Unterminated object body.", parser.tokenFromSpan(start));
  }

  return entries;
}

export function parseObjectMember(parser: ObjectParser): ObjectMemberNode {
  if (parser.isAssignmentStart()) {
    return parser.parseAssignment();
  }

  const start = parser.peek();
  const key = parseObjectKey(parser);

  if (!parser.match("Colon")) {
    return key;
  }

  const value = parser.parseValueExpression();
  return {
    kind: "ObjectEntry",
    key,
    value,
    source: parser.spanFrom(start, value.source),
  } satisfies ObjectEntryNode;
}

export function parseObjectKey(parser: ObjectParser): ObjectKeyNode {
  if (parser.check("String")) {
    return parser.parseLiteral();
  }

  return parser.parseReference();
}

import type { Token, TokenType } from "../lexer/tokens/types.js";
import type {
  IdentifierNode,
  LiteralNode,
  ObjectNode,
  PathNode,
  RelationshipNode,
} from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";

type ReferenceNode = IdentifierNode | PathNode;
type RelationshipLabelNode = IdentifierNode | LiteralNode;

export interface RelationshipParser {
  peek(): Token;
  peekN(offset: number): Token;
  check(type: TokenType): boolean;
  match(type: TokenType): boolean;
  consume(type: TokenType, message: string): Token;
  spanFrom(startInput: Token | SourceSpan | undefined, endInput: Token | SourceSpan | undefined): SourceSpan;
  parseReference(): ReferenceNode;
  parseIdentifier(): IdentifierNode;
  parseLiteral(): LiteralNode;
  parseObject(): ObjectNode;
}

export function parseEdgeRelationship(parser: RelationshipParser): RelationshipNode {
  const start = parser.consume("LeftBrace", "Expected '{' to start edge relationship.");
  const from = parser.parseReference();

  if (parser.match("ImplicitRelation")) {
    return parseImplicitEdgeRelationship(parser, start, from);
  }

  return parseExplicitEdgeRelationship(parser, start, from);
}

export function parseImplicitEdgeRelationship(
  parser: RelationshipParser,
  start: Token,
  from: ReferenceNode,
): RelationshipNode {
  const to = parser.parseReference();
  const end = parser.consume("RightBrace", "Expected '}' after edge relationship.");
  return {
    kind: "Relationship",
    relationshipKind: "edge",
    explicit: false,
    from,
    to,
    source: parser.spanFrom(start, end),
  };
}

export function parseExplicitEdgeRelationship(
  parser: RelationshipParser,
  start: Token,
  from: ReferenceNode,
): RelationshipNode {
  parser.consume("Colon", "Expected ':' or '::' in edge relationship.");
  const relation = parseRelationshipLabel(parser);
  parser.consume("Colon", "Expected ':' before edge relationship target.");
  const to = parser.parseReference();
  const end = parser.consume("RightBrace", "Expected '}' after edge relationship.");

  return {
    kind: "Relationship",
    relationshipKind: "edge",
    explicit: true,
    from,
    relation,
    to,
    source: parser.spanFrom(start, end),
  };
}

export function parseGraphRelationship(parser: RelationshipParser): RelationshipNode {
  const start = parser.peek();
  const left = parser.parseReference();

  if (parser.match("ImplicitRelation")) {
    return parseImplicitGraphRelationship(parser, start, left);
  }

  return parseContextualGraphRelationship(parser, start, left);
}

export function parseImplicitGraphRelationship(
  parser: RelationshipParser,
  start: Token,
  left: ReferenceNode,
): RelationshipNode {
  const right = parser.parseReference();
  const body = parser.check("LeftBrace") ? parser.parseObject() : undefined;
  return {
    kind: "Relationship",
    relationshipKind: "graph",
    explicit: false,
    left,
    right,
    body,
    source: parser.spanFrom(start, body?.source ?? right.source),
  };
}

export function parseContextualGraphRelationship(
  parser: RelationshipParser,
  start: Token,
  left: ReferenceNode,
): RelationshipNode {
  parser.consume("Colon", "Expected ':' or '::' in graph relationship.");
  const context = parser.parseReference();
  parser.consume("Colon", "Expected ':' before graph relationship target.");
  const right = parser.parseReference();
  const body = parser.check("LeftBrace") ? parser.parseObject() : undefined;

  return {
    kind: "Relationship",
    relationshipKind: "graph",
    explicit: true,
    left,
    context,
    right,
    body,
    source: parser.spanFrom(start, body?.source ?? right.source),
  };
}

export function isEdgeRelationshipStart(parser: RelationshipParser): boolean {
  if (!parser.check("LeftBrace")) return false;

  let lookahead = 1;
  lookahead = skipReference(parser, lookahead);
  const separator = parser.peekN(lookahead).type;

  if (separator === "ImplicitRelation") {
    lookahead = skipReference(parser, lookahead + 1);
    return parser.peekN(lookahead).type === "RightBrace";
  }

  if (separator !== "Colon") return false;

  lookahead += 1;
  if (!isRelationshipLabelStart(parser.peekN(lookahead).type)) return false;
  lookahead = skipRelationshipLabel(parser, lookahead);
  if (parser.peekN(lookahead).type !== "Colon") return false;
  lookahead = skipReference(parser, lookahead + 1);
  return parser.peekN(lookahead).type === "RightBrace";
}

export function isGraphRelationshipStart(parser: RelationshipParser): boolean {
  if (!parser.check("Identifier")) return false;

  let lookahead = skipReference(parser, 0);
  const separator = parser.peekN(lookahead).type;

  if (separator === "ImplicitRelation") {
    return parser.peekN(skipReference(parser, lookahead + 1)).type !== "SemanticBind";
  }

  if (separator !== "Colon") return false;

  lookahead = skipReference(parser, lookahead + 1);
  return parser.peekN(lookahead).type === "Colon";
}

function parseRelationshipLabel(parser: RelationshipParser): RelationshipLabelNode {
  if (parser.check("String") || parser.check("Number") || parser.check("Boolean") || parser.check("Null")) {
    return parser.parseLiteral();
  }

  return parser.parseIdentifier();
}

function skipReference(parser: RelationshipParser, offset: number): number {
  if (parser.peekN(offset).type !== "Identifier") return offset;

  let lookahead = offset + 1;
  while (parser.peekN(lookahead).type === "Dot" && parser.peekN(lookahead + 1).type === "Identifier") {
    lookahead += 2;
  }

  return lookahead;
}

function skipRelationshipLabel(parser: RelationshipParser, offset: number): number {
  return isRelationshipLabelStart(parser.peekN(offset).type) ? offset + 1 : offset;
}

function isRelationshipLabelStart(type: TokenType): boolean {
  return (
    type === "Identifier" ||
    type === "String" ||
    type === "Number" ||
    type === "Boolean" ||
    type === "Null"
  );
}

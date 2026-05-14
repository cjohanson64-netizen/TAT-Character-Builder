import type { Token, TokenType } from "../lexer/tokens/types.js";
import type {
  DirectiveName,
  DirectiveNode,
  FlowBodyNode,
  IdentifierNode,
  ObjectNode,
  TatNode,
} from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";
import { parseCallArgs } from "./parseInvocation.js";

export interface DirectiveParser {
  previous(): Token;
  check(type: TokenType): boolean;
  match(type: TokenType): boolean;
  consume(type: TokenType, message: string): Token;
  spanFrom(startInput: Token | SourceSpan | undefined, endInput: Token | SourceSpan | undefined): SourceSpan;
  parseIdentifier(): IdentifierNode;
  parseBraceBody(): ObjectNode | FlowBodyNode;
  parseValueExpression(): TatNode;
}

export function parseDirective(parser: DirectiveParser): DirectiveNode {
  const start = parser.consume("At", "Expected '@' before directive.");
  const name = parser.parseIdentifier().name as DirectiveName;
  const args = parseDirectiveArgs(parser);
  const body = parseDirectiveBody(parser);

  return {
    kind: "Directive",
    name,
    args,
    body,
    source: parser.spanFrom(start, body?.source ?? parser.previous()),
  };
}

export function parseDirectiveArgs(parser: DirectiveParser): TatNode[] {
  parser.consume("LeftParen", "Expected '(' after directive name.");
  const args = parseCallArgs(parser, "RightParen");
  parser.consume("RightParen", "Expected ')' after directive arguments.");
  return args;
}

export function parseDirectiveBody(parser: DirectiveParser): ObjectNode | FlowBodyNode | undefined {
  return parser.check("LeftBrace") ? parser.parseBraceBody() : undefined;
}

import type { Token } from "../lexer/tokens/types.js";
import type { BindingNode, IdentifierNode, TatNode } from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";

export interface BindingParser {
  peek(): Token;
  consume(type: "SemanticBind", message: string): Token;
  spanFrom(startInput: Token | SourceSpan | undefined, endInput: Token | SourceSpan | undefined): SourceSpan;
  parseIdentifier(): IdentifierNode;
  parseValueExpression(): TatNode;
}

export function parseBinding(parser: BindingParser): BindingNode {
  const start = parser.peek();
  const name = parser.parseIdentifier();
  parser.consume("SemanticBind", "Expected ':=' after binding name.");
  const value = parser.parseValueExpression();

  return {
    kind: "Binding",
    name,
    value,
    source: parser.spanFrom(start, value.source),
  };
}

import type { Token } from "../lexer/tokens/types.js";
import type { AssignmentNode, IdentifierNode, PathNode, TatNode } from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";

type AssignmentTargetNode = IdentifierNode | PathNode;

export interface AssignmentParser {
  peek(): Token;
  consume(type: "Assign", message: string): Token;
  spanFrom(startInput: Token | SourceSpan | undefined, endInput: Token | SourceSpan | undefined): SourceSpan;
  parseReference(): AssignmentTargetNode;
  parseValueExpression(): TatNode;
}

export function parseAssignment(parser: AssignmentParser): AssignmentNode {
  const start = parser.peek();
  const target = parseAssignmentTarget(parser);
  parser.consume("Assign", "Expected '=' in assignment.");
  const value = parser.parseValueExpression();

  return {
    kind: "Assignment",
    target,
    value,
    source: parser.spanFrom(start, value.source),
  };
}

export function parseAssignmentTarget(parser: AssignmentParser): AssignmentTargetNode {
  return parser.parseReference();
}

import type { Token, TokenType } from "../lexer/tokens/types.js";
import type {
  BinaryExpressionNode,
  ComparisonExpressionNode,
  DirectiveNode,
  FunctionCallExpressionNode,
  IdentifierNode,
  InvocationNode,
  LiteralNode,
  BridgeDefinitionNode,
  NodeDefinitionNode,
  ObjectNode,
  PathNode,
  RelationshipNode,
  TatNode,
  TernaryExpressionNode,
  UnaryExpressionNode,
} from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";
import { ParseError } from "./errors.js";

type ReferenceNode = IdentifierNode | PathNode;

export interface ExpressionParser {
  peek(): Token;
  previous(): Token;
  check(type: TokenType): boolean;
  match(type: TokenType): boolean;
  consume(type: TokenType, message: string): Token;
  spanFrom(startInput: Token | SourceSpan | undefined, endInput: Token | SourceSpan | undefined): SourceSpan;
  parseLiteral(): LiteralNode;
  parseReference(): ReferenceNode;
  finishCall(callee: ReferenceNode): InvocationNode | FunctionCallExpressionNode;
  parseDirective(): DirectiveNode;
  parseArray(): TatNode;
  isEdgeRelationshipStart(): boolean;
  parseEdgeRelationship(): RelationshipNode;
  isFlowBodyStart(): boolean;
  parseFlowBody(): TatNode;
  parseObject(): ObjectNode;
  parseNodeDefinition(): NodeDefinitionNode | BridgeDefinitionNode;
  parseValueExpression(): TatNode;
  peekN(offset: number): Token;
}

const COMPARISON_OPERATORS = new Set<TokenType>([
  "EqualEqual",
  "BangEqual",
  "Less",
  "Greater",
  "LessEqual",
  "GreaterEqual",
]);

const ADDITIVE_OPERATORS = new Set<TokenType>(["Plus", "Minus"]);
const MULTIPLICATIVE_OPERATORS = new Set<TokenType>(["Star", "Slash", "Percent"]);
const EXPONENT_OPERATORS = new Set<TokenType>(["Caret"]);

const OPERATOR_LEXEMES: Partial<Record<TokenType, string>> = {
  EqualEqual: "==",
  BangEqual: "!=",
  Less: "<",
  Greater: ">",
  LessEqual: "<=",
  GreaterEqual: ">=",
  Plus: "+",
  Minus: "-",
  Star: "*",
  Slash: "/",
  Percent: "%",
  Caret: "^",
};

export function parseExpression(parser: ExpressionParser): TatNode {
  return parseTernaryExpression(parser);
}

export function parseTernaryExpression(parser: ExpressionParser): TatNode {
  const start = parser.peek();
  const condition = parseComparisonExpression(parser);
  if (!parser.match("Question" as TokenType)) return condition;
  const whenTrue = parseExpression(parser);
  parser.consume("Colon", "Expected ':' in ternary expression.");
  const whenFalse = parseExpression(parser);
  return {
    kind: "Expression",
    expressionKind: "ternary",
    condition,
    whenTrue,
    whenFalse,
    source: parser.spanFrom(start, whenFalse.source),
  } satisfies TernaryExpressionNode;
}

export function parseComparisonExpression(parser: ExpressionParser): TatNode {
  const start = parser.peek();

  if (!isTypedEntityStart(parser) && matchAny(parser, COMPARISON_OPERATORS)) {
    const operator = operatorFrom(parser.previous()) as ComparisonExpressionNode["operator"];
    const right = parseAdditiveExpression(parser);
    return {
      kind: "Expression",
      expressionKind: "comparison",
      operator,
      right,
      source: parser.spanFrom(start, right.source),
    } satisfies ComparisonExpressionNode;
  }

  const left = parseAdditiveExpression(parser);

  if (!matchAny(parser, COMPARISON_OPERATORS)) {
    return left;
  }

  const operator = operatorFrom(parser.previous()) as ComparisonExpressionNode["operator"];
  const right = parseAdditiveExpression(parser);

  return {
    kind: "Expression",
    expressionKind: "comparison",
    operator,
    left,
    right,
    source: parser.spanFrom(start, right.source),
  } satisfies ComparisonExpressionNode;
}

export function parseAdditiveExpression(parser: ExpressionParser): TatNode {
  return parseBinaryExpression(parser, () => parseMultiplicativeExpression(parser), ADDITIVE_OPERATORS);
}

export function parseMultiplicativeExpression(parser: ExpressionParser): TatNode {
  return parseBinaryExpression(parser, () => parseExponentExpression(parser), MULTIPLICATIVE_OPERATORS);
}

export function parseExponentExpression(parser: ExpressionParser): TatNode {
  return parseBinaryExpression(parser, () => parseUnaryExpression(parser), EXPONENT_OPERATORS);
}

function parseBinaryExpression(
  parser: ExpressionParser,
  parseOperand: () => TatNode,
  operators: ReadonlySet<TokenType>,
): TatNode {
  const start = parser.peek();
  let expr = parseOperand();

  while (matchAny(parser, operators)) {
    const operator = operatorFrom(parser.previous()) as BinaryExpressionNode["operator"];
    const right = parseOperand();
    expr = {
      kind: "Expression",
      expressionKind: "binary",
      operator,
      left: expr,
      right,
      source: parser.spanFrom(start, right.source),
    } satisfies BinaryExpressionNode;
  }

  return expr;
}

export function parseUnaryExpression(parser: ExpressionParser): TatNode {
  if (!parser.match("Minus")) {
    return parsePrimaryExpression(parser);
  }

  const start = parser.previous();
  const value = parseUnaryExpression(parser);
  return {
    kind: "Expression",
    expressionKind: "unary",
    operator: "-",
    value,
    source: parser.spanFrom(start, value.source),
  } satisfies UnaryExpressionNode;
}

export function parsePrimaryExpression(parser: ExpressionParser): TatNode {
  if (parser.check("String") || parser.check("Number") || parser.check("Boolean") || parser.check("Null")) {
    return parser.parseLiteral();
  }

  if (parser.check("Identifier")) {
    const reference = parser.parseReference();
    if (!parser.match("LeftParen")) {
      return reference;
    }

    return parser.finishCall(reference);
  }

  if (parser.check("At")) {
    return parser.parseDirective();
  }

  if (parser.check("LeftBracket")) {
    return parser.parseArray();
  }

  if (parser.check("LeftBrace")) {
    if (parser.isEdgeRelationshipStart()) {
      return parser.parseEdgeRelationship();
    }

    if (parser.isFlowBodyStart()) {
      return parser.parseFlowBody();
    }

    return parser.parseObject();
  }

  if (parser.check("NodeBodyStart") || isTypedEntityStart(parser)) {
    return parser.parseNodeDefinition();
  }

  if (parser.match("LeftParen")) {
    const expr = parser.parseValueExpression();
    parser.consume("RightParen", "Expected ')' after expression.");
    return expr;
  }

  throw new ParseError(`Expected expression, found ${parser.peek().type}.`, parser.peek());
}

function isTypedEntityStart(parser: ExpressionParser): boolean {
  return parser.check("Less")
    && parser.peekN(1).type === "Identifier"
    && parser.peekN(2).type === "LeftBrace";
}

function matchAny(parser: ExpressionParser, types: ReadonlySet<TokenType>): boolean {
  if (!types.has(parser.peek().type)) return false;
  parser.match(parser.peek().type);
  return true;
}

function operatorFrom(token: Token): string {
  return OPERATOR_LEXEMES[token.type] ?? token.value;
}

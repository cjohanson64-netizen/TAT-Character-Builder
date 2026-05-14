import type { Token, TokenType } from "../lexer/tokens/types.js";
import { ParseError } from "./errors.js";
import { parseArray } from "./parseArray.js";
import { parseAssignment } from "./parseAssignment.js";
import { parseBinding } from "./parseBinding.js";
import { parseDirective } from "./parseDirective.js";
import { isFlowBodyStart, parseFlow, parseFlowBody } from "./parseFlow.js";
import { finishCall } from "./parseInvocation.js";
import { parseLiteral } from "./parseLiteral.js";
import { parseExport, parseImport } from "./parseModule.js";
import { parseNodeDefinition } from "./parseNodeDefinition.js";
import { parseObject } from "./parseObject.js";
import { parseIdentifier, parseReference } from "./parseReference.js";
import {
  isEdgeRelationshipStart,
  isGraphRelationshipStart,
  parseEdgeRelationship,
  parseGraphRelationship,
} from "./parseRelationship.js";
import type {
  ArrayNode,
  BindingNode,
  BridgeDefinitionNode,
  DirectiveNode,
  FlowBodyNode,
  IdentifierNode,
  LiteralNode,
  NodeDefinitionNode,
  ObjectNode,
  PathNode,
  ProgramNode,
  RelationshipNode,
  TatNode,
} from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";

type ReferenceNode = IdentifierNode | PathNode;

export class V3Parser {
  private current = 0;

  constructor(private readonly tokens: Token[]) {}

  parseProgram(): ProgramNode {
    const start = this.peek();
    const body: TatNode[] = [];

    while (!this.isAtEnd()) {
      body.push(this.parseStatement());
      this.match("Comma");
    }

    return {
      kind: "Program",
      body,
      source: this.spanFrom(start, this.previous()),
    };
  }

  private parseStatement(): TatNode {
    if (this.checkIdentifierValue("import")) {
      return parseImport(this);
    }

    if (this.checkIdentifierValue("export")) {
      return parseExport(this);
    }

    if (this.check("Identifier") && this.checkNext("SemanticBind")) {
      return parseBinding(this);
    }

    if (this.check("At")) {
      return this.parseDirective();
    }

    if (isGraphRelationshipStart(this)) {
      return parseGraphRelationship(this);
    }

    return this.parseValueExpression();
  }

  parseValueExpression(): TatNode {
    if (this.isAssignmentStart()) {
      return this.parseAssignment();
    }

    return parseFlow(this);
  }

  parseAssignment() {
    return parseAssignment(this);
  }

  parseDirective(): DirectiveNode {
    return parseDirective(this);
  }

  parseBraceBody(): ObjectNode | FlowBodyNode {
    return isFlowBodyStart(this) ? this.parseFlowBody() : this.parseObject();
  }

  parseFlowBody(): FlowBodyNode {
    return parseFlowBody(this);
  }

  parseEdgeRelationship(): RelationshipNode {
    return parseEdgeRelationship(this);
  }

  parseNodeDefinition(): NodeDefinitionNode | BridgeDefinitionNode {
    return parseNodeDefinition(this);
  }

  parseObject(): ObjectNode {
    return parseObject(this);
  }

  parseArray(): ArrayNode {
    return parseArray(this);
  }

  finishCall(callee: ReferenceNode) {
    return finishCall(this, callee);
  }

  parseReference(): ReferenceNode {
    return parseReference(this);
  }

  parseIdentifier(): IdentifierNode {
    return parseIdentifier(this);
  }

  parseLiteral(): LiteralNode {
    return parseLiteral(this);
  }

  isAssignmentStart(): boolean {
    if (!this.check("Identifier")) return false;

    let lookahead = 1;
    while (this.peekN(lookahead).type === "Dot") {
      lookahead += 1;
      if (this.peekN(lookahead).type !== "Identifier") return false;
      lookahead += 1;
    }

    return this.peekN(lookahead).type === "Assign";
  }

  isEdgeRelationshipStart(): boolean {
    return isEdgeRelationshipStart(this);
  }

  isFlowBodyStart(): boolean {
    return isFlowBodyStart(this);
  }

  match(type: TokenType): boolean {
    if (!this.check(type)) return false;
    this.advance();
    return true;
  }

  consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new ParseError(message, this.peek());
  }

  check(type: TokenType): boolean {
    return !this.isAtEnd() && this.peek().type === type;
  }

  private checkNext(type: TokenType): boolean {
    return this.peekN(1).type === type;
  }

  private checkIdentifierValue(value: string): boolean {
    return this.check("Identifier") && this.peek().value === value;
  }

  advance(): Token {
    if (!this.isAtEnd()) this.current += 1;
    return this.previous();
  }

  isAtEnd(): boolean {
    return this.peek().type === "EOF";
  }

  peek(): Token {
    return this.tokens[this.current];
  }

  peekN(offset: number): Token {
    return this.tokens[this.current + offset] ?? this.tokens[this.tokens.length - 1];
  }

  previous(): Token {
    return this.tokens[this.current - 1];
  }

  spanFrom(
    startInput: Token | SourceSpan | undefined,
    endInput: Token | SourceSpan | undefined,
  ): SourceSpan {
    const fallback = this.toSpan(this.peek()) ?? {
      start: 0,
      end: 0,
      line: 1,
      column: 1,
    };
    const start = this.toSpan(startInput) ?? fallback;
    const end = this.toSpan(endInput) ?? start;

    return {
      start: start.start,
      end: end.end,
      line: start.line,
      column: start.column,
    };
  }

  private toSpan(input: Token | SourceSpan | undefined): SourceSpan | undefined {
    if (!input) return undefined;
    if ("type" in input) {
      return input.span ?? {
        start: input.index,
        end: input.index + input.value.length,
        line: input.line,
        column: input.column,
      };
    }

    return input;
  }

  tokenFromSpan(span: Token | SourceSpan): Token {
    if ("type" in span) return span;
    const source = this.toSpan(span);

    return {
      type: "Unknown",
      value: "",
      line: span.line,
      column: span.column,
      index: span.start,
      span: source,
    };
  }
}

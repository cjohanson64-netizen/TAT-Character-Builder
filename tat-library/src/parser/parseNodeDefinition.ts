import type { Token } from "../lexer/tokens/types.js";
import type { BridgeDefinitionNode, NodeDefinitionNode, NodeEntityType, ObjectMemberNode } from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";
import { ParseError } from "./errors.js";
import { parseObjectMembers, type ObjectParser } from "./parseObject.js";

export type EntityDefinitionNode = NodeDefinitionNode | BridgeDefinitionNode;

export interface NodeDefinitionParser extends ObjectParser {
  match(type: "Less" | "Greater" | "Identifier" | "LeftBrace" | "RightBrace"): boolean;
  check(type: "Less" | "Greater" | "Identifier" | "LeftBrace" | "RightBrace" | "NodeBodyStart" | "NodeBodyEnd"): boolean;
  consume(type: "Less" | "Greater" | "Identifier" | "LeftBrace" | "RightBrace" | "NodeBodyStart" | "NodeBodyEnd", message: string): Token;
  peek(): Token;
  peekN(offset: number): Token;
  spanFrom(startInput: Token | SourceSpan | undefined, endInput: Token | SourceSpan | undefined): SourceSpan;
}

const NODE_ENTITY_TYPES = new Set(["node", "context", "hook"]);

export function parseNodeDefinition(parser: NodeDefinitionParser): EntityDefinitionNode {
  if (parser.check("NodeBodyStart")) {
    throw new ParseError('Legacy node literal "<{ ... }>" is retired. Use "<node { ... }>".', parser.peek());
  }

  const start = parser.consume("Less", "Expected '<' to start entity definition.");
  const entity = parser.consume("Identifier", "Expected entity type after '<'.");
  parser.consume("LeftBrace", `Expected '{' after <${entity.value}.`);
  const body = parseObjectMembers(parser, "NodeBodyEnd", start);
  const end = parser.consume("NodeBodyEnd", `Expected '}>' after <${entity.value} body.`);
  const rightBrace = end;
  const object = {
    kind: "Object" as const,
    entries: body,
    source: parser.spanFrom(start, rightBrace),
  };

  if (entity.value === "bridge") {
    return {
      kind: "BridgeDefinition",
      body: object,
      source: parser.spanFrom(start, end),
    };
  }

  if (!NODE_ENTITY_TYPES.has(entity.value)) {
    throw new ParseError(`Unknown entity type "${entity.value}".`, entity);
  }

  return {
    kind: "NodeDefinition",
    entityType: entity.value as NodeEntityType,
    body: object,
    source: parser.spanFrom(start, end),
  };
}

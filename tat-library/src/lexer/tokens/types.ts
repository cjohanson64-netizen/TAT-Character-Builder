export type LegacyTokenType =
  | "IDENT"
  | "KEYWORD"
  | "STRING"
  | "NUMBER"
  | "BOOLEAN"
  | "REGEX"
  | "WILDCARD"
  | "EQUALS"
  | "COLON_EQUALS"
  | "EQ2"
  | "EQ3"
  | "NEQ2"
  | "NEQ3"
  | "LTE"
  | "GTE"
  | "AND"
  | "OR"
  | "BANG"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "PERCENT"
  | "DOT"
  | "DDOT"
  | "COLON"
  | "DCOLON"
  | "TCOLON"
  | "ARROW"
  | "INJECT_FLOW"
  | "PROJECT"
  | "LPAREN"
  | "RPAREN"
  | "LBRACKET"
  | "RBRACKET"
  | "LBRACE"
  | "RBRACE"
  | "LANGLE"
  | "RANGLE"
  | "COMMA"
  | "NEWLINE"
  | "EOF";

export type V3TokenType =
  | "EOF"
  | "Unknown"
  | "Identifier"
  | "String"
  | "Number"
  | "Boolean"
  | "Null"
  | "At"
  | "SemanticBind"
  | "Assign"
  | "MutationFlow"
  | "InjectionFlow"
  | "ProjectionFlow"
  | "ConditionalGate"
  | "NegatedGate"
  | "FallbackGate"
  | "ImplicitRelation"
  | "Colon"
  | "Dot"
  | "EqualEqual"
  | "BangEqual"
  | "Less"
  | "Greater"
  | "LessEqual"
  | "GreaterEqual"
  | "Plus"
  | "Minus"
  | "Star"
  | "Slash"
  | "Percent"
  | "Caret"
  | "Question"
  | "Bang"
  | "LeftBrace"
  | "RightBrace"
  | "NodeBodyStart"
  | "NodeBodyEnd"
  | "LeftBracket"
  | "RightBracket"
  | "LeftParen"
  | "RightParen"
  | "Comma";

export type TokenType = LegacyTokenType | V3TokenType;

export type TokenMode = "legacy" | "v3";

export interface Token {
  type: TokenType;
  value: string;
  lexeme?: string;
  line: number;
  column: number;
  index: number;
  span?: {
    start: number;
    end: number;
    line: number;
    column: number;
  };
}

export interface TokenSpec {
  type: TokenType;
  value: string;
}

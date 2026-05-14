import type { LegacyTokenType, Token, TokenMode, TokenType } from "../tokens/types.js";

const V3_TOKEN_TYPES: Partial<Record<LegacyTokenType, TokenType>> = {
  IDENT: "Identifier",
  STRING: "String",
  NUMBER: "Number",
  BOOLEAN: "Boolean",
  EQUALS: "Assign",
  COLON_EQUALS: "SemanticBind",
  EQ2: "EqualEqual",
  NEQ2: "BangEqual",
  LTE: "LessEqual",
  GTE: "GreaterEqual",
  PLUS: "Plus",
  MINUS: "Minus",
  STAR: "Star",
  SLASH: "Slash",
  DOT: "Dot",
  COLON: "Colon",
  DCOLON: "ImplicitRelation",
  ARROW: "MutationFlow",
  INJECT_FLOW: "InjectionFlow",
  PROJECT: "ProjectionFlow",
  LPAREN: "LeftParen",
  RPAREN: "RightParen",
  LBRACKET: "LeftBracket",
  RBRACKET: "RightBracket",
  LBRACE: "LeftBrace",
  RBRACE: "RightBrace",
  LANGLE: "Less",
  RANGLE: "Greater",
  COMMA: "Comma",
  EOF: "EOF",
};

export class Scanner {
  public readonly tokens: Token[] = [];
  private i = 0;
  private line = 1;
  private column = 1;

  constructor(
    public readonly source: string,
    private readonly mode: TokenMode = "legacy",
  ) {}

  get index(): number {
    return this.i;
  }

  get currentLine(): number {
    return this.line;
  }

  get currentColumn(): number {
    return this.column;
  }

  get isAtEnd(): boolean {
    return this.i >= this.source.length;
  }

  get tokenMode(): TokenMode {
    return this.mode;
  }

  current(offset = 0): string {
    return this.source[this.i + offset] ?? "";
  }

  advance(count = 1): void {
    for (let j = 0; j < count; j++) {
      const ch = this.source[this.i];
      this.i += 1;
      if (ch === "\n") {
        this.line += 1;
        this.column = 1;
      } else {
        this.column += 1;
      }
    }
  }

  match(value: string): boolean {
    return this.source.startsWith(value, this.i);
  }

  addToken(
    type: TokenType,
    value: string,
    startLine = this.line,
    startColumn = this.column,
    startIndex = this.i,
  ): void {
    const emittedType =
      this.mode === "v3" && type in V3_TOKEN_TYPES
        ? V3_TOKEN_TYPES[type as LegacyTokenType] ?? type
        : type;

    this.tokens.push({
      type: emittedType,
      value,
      lexeme: value,
      line: startLine,
      column: startColumn,
      index: startIndex,
      span: {
        start: startIndex,
        end: startIndex + value.length,
        line: startLine,
        column: startColumn,
      },
    });
  }

  mark(): { line: number; column: number; index: number } {
    return {
      line: this.line,
      column: this.column,
      index: this.i,
    };
  }
}

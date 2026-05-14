import type { Token } from "../lexer/tokens/types.js";

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly token: Token,
  ) {
    super(`${message} at ${token.line}:${token.column}`);
    this.name = "ParseError";
  }
}

import type { Scanner } from "../core/Scanner.js";
import { TokenizeError } from "../errors/TokenizeError.js";

export function readString(scanner: Scanner): void {
  const quote = scanner.current();
  const start = scanner.mark();

  let value = quote;
  scanner.advance();

  while (!scanner.isAtEnd) {
    const ch = scanner.current();

    if (ch === "\\") {
      value += ch;
      scanner.advance();

      if (scanner.isAtEnd) {
        throw new TokenizeError(
          "Unterminated escape sequence in string",
          scanner.currentLine,
          scanner.currentColumn,
          scanner.index,
        );
      }

      value += scanner.current();
      scanner.advance();
      continue;
    }

    if (ch === quote) {
      value += ch;
      scanner.advance();
      scanner.addToken("STRING", value, start.line, start.column, start.index);
      return;
    }

    if (ch === "\n") {
      throw new TokenizeError(
        "Unterminated string literal",
        start.line,
        start.column,
        start.index,
      );
    }

    value += ch;
    scanner.advance();
  }

  throw new TokenizeError(
    "Unterminated string literal",
    start.line,
    start.column,
    start.index,
  );
}

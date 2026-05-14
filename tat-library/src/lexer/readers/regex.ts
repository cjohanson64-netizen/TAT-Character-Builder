import type { Scanner } from "../core/Scanner.js";
import { TokenizeError } from "../errors/TokenizeError.js";

export function isRegexStart(scanner: Scanner): boolean {
  if (scanner.current() !== "/") return false;

  const prev = scanner.tokens[scanner.tokens.length - 1];
  if (!prev) return true;

  // Conservative rule: allow regex after delimiters, operators, newline, or keywords.
  return (
    prev.type === "NEWLINE" ||
    prev.type === "LPAREN" ||
    prev.type === "LBRACKET" ||
    prev.type === "LBRACE" ||
    prev.type === "COMMA" ||
    prev.type === "COLON" ||
    prev.type === "DCOLON" ||
    prev.type === "TCOLON" ||
    prev.type === "EQUALS" ||
    prev.type === "COLON_EQUALS" ||
    prev.type === "ARROW" ||
    prev.type === "PROJECT" ||
    prev.type === "KEYWORD"
  );
}

export function readRegex(scanner: Scanner): void {
  const start = scanner.mark();

  let value = "";
  let escaped = false;

  value += scanner.current();
  scanner.advance(); // initial /

  while (!scanner.isAtEnd) {
    const ch = scanner.current();

    value += ch;
    scanner.advance();

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === "/") {
      while (/[a-z]/i.test(scanner.current())) {
        value += scanner.current();
        scanner.advance();
      }

      scanner.addToken("REGEX", value, start.line, start.column, start.index);
      return;
    }

    if (ch === "\n") {
      throw new TokenizeError(
        "Unterminated regex literal",
        start.line,
        start.column,
        start.index,
      );
    }
  }

  throw new TokenizeError(
    "Unterminated regex literal",
    start.line,
    start.column,
    start.index,
  );
}

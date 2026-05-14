import { isIdentPart } from "../chars/classifiers.js";
import type { Scanner } from "../core/Scanner.js";

export function readIdentifier(scanner: Scanner): void {
  const start = scanner.mark();

  let value = "";

  while (isIdentPart(scanner.current())) {
    value += scanner.current();
    scanner.advance();
  }

  if (value === "true" || value === "false") {
    scanner.addToken("BOOLEAN", value, start.line, start.column, start.index);
    return;
  }

  if (scanner.tokenMode === "v3" && value === "null") {
    scanner.addToken("Null", value, start.line, start.column, start.index);
    return;
  }

  scanner.addToken("IDENT", value, start.line, start.column, start.index);
}

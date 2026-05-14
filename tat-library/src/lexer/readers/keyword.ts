import { isKeywordPart } from "../chars/classifiers.js";
import type { Scanner } from "../core/Scanner.js";

export function readKeyword(scanner: Scanner): void {
  const start = scanner.mark();

  let value = "";

  while (isKeywordPart(scanner.current())) {
    value += scanner.current();
    scanner.advance();
  }

  scanner.addToken("KEYWORD", value, start.line, start.column, start.index);
}

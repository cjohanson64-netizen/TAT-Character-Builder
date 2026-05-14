import { isDigit } from "../chars/classifiers.js";
import type { Scanner } from "../core/Scanner.js";

export function readNumber(scanner: Scanner): void {
  const start = scanner.mark();

  let value = "";

  while (isDigit(scanner.current())) {
    value += scanner.current();
    scanner.advance();
  }

  if (scanner.current() === "." && isDigit(scanner.current(1))) {
    value += scanner.current();
    scanner.advance();

    while (isDigit(scanner.current())) {
      value += scanner.current();
      scanner.advance();
    }
  }

  scanner.addToken("NUMBER", value, start.line, start.column, start.index);
}

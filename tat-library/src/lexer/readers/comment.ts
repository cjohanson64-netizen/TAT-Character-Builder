import type { Scanner } from "../core/Scanner.js";

export function skipLineComment(scanner: Scanner): void {
  while (!scanner.isAtEnd && scanner.current() !== "\n") {
    scanner.advance();
  }
}

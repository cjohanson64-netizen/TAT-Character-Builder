import { isDigit, isIdentStart, isWhitespace } from "../chars/classifiers.js";
import { Scanner } from "./Scanner.js";
import { TokenizeError } from "../errors/TokenizeError.js";
import {
  CLOSE_SYMBOLS,
  MULTI_CHAR_OPERATORS,
  MULTI_CHAR_SEPARATORS,
  OPEN_SYMBOLS,
  SINGLE_CHAR_OPERATORS,
  SINGLE_CHAR_SEPARATORS,
} from "../tokens/symbols/index.js";
import type { Token, TokenMode, TokenSpec } from "../tokens/types.js";
import {
  isRegexStart,
  readIdentifier,
  readKeyword,
  readNumber,
  readRegex,
  readString,
  skipLineComment,
} from "../readers/index.js";

function consumeSpec(scanner: Scanner, spec: TokenSpec): boolean {
  if (!scanner.match(spec.value)) return false;

  scanner.addToken(spec.type, spec.value);
  scanner.advance(spec.value.length);
  return true;
}

function consumeAnySpec(scanner: Scanner, specs: readonly TokenSpec[]): boolean {
  return specs.some((spec) => consumeSpec(scanner, spec));
}

export interface TokenizeOptions {
  mode?: TokenMode;
}

const V3_MULTI_CHAR_TOKENS: readonly TokenSpec[] = [
  { type: "NodeBodyStart", value: "<{" },
  { type: "NodeBodyEnd", value: "}>" },
  { type: "COLON_EQUALS", value: ":=" },
  { type: "ARROW", value: "->" },
  { type: "INJECT_FLOW", value: "<-" },
  { type: "PROJECT", value: "<>" },
  { type: "ConditionalGate", value: "?>" },
  { type: "NegatedGate", value: "!>" },
  { type: "FallbackGate", value: ":>" },
  { type: "DCOLON", value: "::" },
  { type: "EQ2", value: "==" },
  { type: "NEQ2", value: "!=" },
  { type: "LTE", value: "<=" },
  { type: "GTE", value: ">=" },
];

const V3_SINGLE_CHAR_TOKENS: readonly TokenSpec[] = [
  { type: "EQUALS", value: "=" },
  { type: "LANGLE", value: "<" },
  { type: "RANGLE", value: ">" },
  { type: "PLUS", value: "+" },
  { type: "MINUS", value: "-" },
  { type: "STAR", value: "*" },
  { type: "SLASH", value: "/" },
  { type: "Percent", value: "%" },
  { type: "Caret", value: "^" },
  { type: "Question", value: "?" },
  { type: "Bang", value: "!" },
  { type: "COLON", value: ":" },
  { type: "DOT", value: "." },
  { type: "LBRACE", value: "{" },
  { type: "RBRACE", value: "}" },
  { type: "LBRACKET", value: "[" },
  { type: "RBRACKET", value: "]" },
  { type: "LPAREN", value: "(" },
  { type: "RPAREN", value: ")" },
  { type: "COMMA", value: "," },
];

export function tokenize(source: string, options: TokenizeOptions = {}): Token[] {
  const mode = options.mode ?? "v3";
  const scanner = new Scanner(source, mode);

  while (!scanner.isAtEnd) {
    const ch = scanner.current();

    if (isWhitespace(ch)) {
      scanner.advance();
      continue;
    }

    if (ch === "\n") {
      if (mode === "v3") {
        scanner.advance();
        continue;
      }

      scanner.addToken("NEWLINE", "\n");
      scanner.advance();
      continue;
    }

    if (scanner.match("//")) {
      skipLineComment(scanner);
      continue;
    }

    if (mode === "v3" && consumeAnySpec(scanner, V3_MULTI_CHAR_TOKENS)) continue;
    if (mode === "v3" && ch === "@") {
      scanner.addToken("At", "@");
      scanner.advance();
      continue;
    }
    if (mode === "v3" && consumeAnySpec(scanner, V3_SINGLE_CHAR_TOKENS)) continue;

    if (consumeAnySpec(scanner, MULTI_CHAR_SEPARATORS)) continue;
    if (consumeAnySpec(scanner, MULTI_CHAR_OPERATORS)) continue;

    if (consumeAnySpec(scanner, SINGLE_CHAR_OPERATORS)) continue;
    if (consumeAnySpec(scanner, SINGLE_CHAR_SEPARATORS)) continue;
    if (consumeAnySpec(scanner, OPEN_SYMBOLS)) continue;
    if (consumeAnySpec(scanner, CLOSE_SYMBOLS)) continue;

    if (ch === "_") {
      scanner.addToken("WILDCARD", "_");
      scanner.advance();
      continue;
    }

    if (ch === '"' || ch === "'") {
      readString(scanner);
      continue;
    }

    if (ch === "@") {
      readKeyword(scanner);
      continue;
    }

    if (ch === "/") {
      if (isRegexStart(scanner)) {
        readRegex(scanner);
      } else {
        scanner.addToken("SLASH", "/");
        scanner.advance();
      }
      continue;
    }

    if (isDigit(ch)) {
      readNumber(scanner);
      continue;
    }

    if (isIdentStart(ch)) {
      readIdentifier(scanner);
      continue;
    }

    throw new TokenizeError(
      `Unexpected character "${ch}"`,
      scanner.currentLine,
      scanner.currentColumn,
      scanner.index,
    );
  }

  scanner.addToken("EOF", "");
  return scanner.tokens;
}

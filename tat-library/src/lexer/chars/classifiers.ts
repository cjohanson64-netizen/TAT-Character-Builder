export function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\r";
}

export function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

export function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

export function isIdentPart(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

export function isKeywordPart(ch: string): boolean {
  return /[A-Za-z0-9_.@]/.test(ch);
}

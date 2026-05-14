export class TokenizeError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
    public readonly index: number,
  ) {
    super(`${message} at ${line}:${column}`);
    this.name = "TokenizeError";
  }
}

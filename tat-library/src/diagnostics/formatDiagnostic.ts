import type { Diagnostic } from "./diagnostic.js";

export function formatDiagnostic(diagnostic: Diagnostic): string {
  return diagnostic.message;
}

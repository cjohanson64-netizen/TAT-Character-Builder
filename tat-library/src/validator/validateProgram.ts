import type { ProgramNode } from "../ast/nodes.js";
import {
  validateV3Program as validateProgramWithEngine,
  validateV3Source as validateSourceWithEngine,
  type V3ValidationResult,
} from "./validationEngine.js";

export type {
  V3Diagnostic,
  V3DiagnosticSeverity,
  V3SymbolInfo,
  V3SymbolKind,
  V3SymbolTable,
  V3ValidationResult,
} from "./validationEngine.js";

export function validateV3Source(source: string): V3ValidationResult {
  return validateSourceWithEngine(source);
}

export function validateV3Program(program: ProgramNode): V3ValidationResult {
  return validateProgramWithEngine(program);
}

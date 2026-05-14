export { runV3Program } from "./engine/runProgram.js";
export { runV3Source } from "./engine/runSource.js";
export { evaluateReadDirective, evaluateV3Value, resolvePath } from "./evaluation/evaluateValue.js";
export type {
  V3EvaluationContext,
  V3MatchResult,
  V3PathResult,
  V3QueryResult,
  V3TraversalResult,
} from "./evaluation/evaluateValue.js";
export type * from "./context.js";

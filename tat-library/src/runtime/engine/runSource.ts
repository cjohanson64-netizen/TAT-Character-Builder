import { parseV3Program } from "../../parser/parseProgram.js";
import type { V3RuntimeOptions, V3RuntimeResult } from "../context.js";
import { createResult } from "./createResult.js";
import { runV3Program } from "./runProgram.js";

export function runV3Source(source: string, options: V3RuntimeOptions = {}): V3RuntimeResult {
  try {
    return runV3Program(parseV3Program(source), options);
  } catch (error) {
    return createResult({
      bindings: {},
      graphs: {},
      bridges: {},
      networks: {},
      projections: {},
      events: [],
      exports: {},
      diagnostics: [
        {
          severity: "error",
          message: error instanceof Error ? error.message : "Unable to parse TAT v3 source.",
        },
      ],
      options,
    });
  }
}

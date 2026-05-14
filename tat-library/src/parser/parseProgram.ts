import { tokenize } from "../lexer/tokenize.js";
import type { ProgramNode } from "../ast/nodes.js";
import { V3Parser } from "./parser.js";

export function parseV3Program(source: string): ProgramNode {
  return new V3Parser(tokenize(source, { mode: "v3" })).parseProgram();
}

import type { FlowStepNode } from "../ast/nodes.js";
import { parseV3Program } from "./parseProgram.js";

export function parseInjectedFlowFragment(source: string): FlowStepNode[] {
  const program = parseV3Program(`injected := graph\n${source}`);
  const statement = program.body[0];

  if (
    program.body.length !== 1 ||
    statement?.kind !== "Binding" ||
    statement.value.kind !== "Flow"
  ) {
    throw new Error("Injected TAT must be a graph-flow fragment.");
  }

  return statement.value.steps;
}

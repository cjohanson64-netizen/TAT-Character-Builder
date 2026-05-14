import type { TatNode } from "../../../ast/nodes.js";
import type { V3GraphInstance, V3RuntimeContext } from "../../context.js";
import { evaluateV3Value } from "../../evaluation/evaluateValue.js";
import { pathParts } from "../../directives/mutationHelpers.js";

export function createGraph(id: string, root: string): V3GraphInstance {
  return {
    type: "graph",
    id,
    root,
    nodes: {},
    edges: {},
    state: {},
    meta: {},
    localBindings: {},
    relationships: [],
    history: [],
  };
}

export function initializeGraphRecord(
  target: Record<string, Record<string, unknown>>,
  value: TatNode | undefined,
  context: V3RuntimeContext,
  graph: V3GraphInstance,
): void {
  if (!value || value.kind !== "Object") return;

  for (const entry of value.entries) {
    if (entry.kind !== "ObjectEntry") continue;

    const targetPath = pathParts(entry.key);
    if (targetPath.length === 0) continue;

    const [subject, ...rest] = targetPath;
    const key = rest.join(".");
    if (!key) continue;

    target[subject] ??= {};
    target[subject][key] = evaluateV3Value(entry.value, { runtime: context, graph });
  }
}

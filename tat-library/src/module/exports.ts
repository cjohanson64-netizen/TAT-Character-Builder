import type { ExportNode } from "../ast/nodes.js";
import type { V3RuntimeBindings, V3RuntimeContext } from "../runtime/context.js";

export type { V3RuntimeBindings };

export function collectExports(exports: ExportNode[], context: V3RuntimeContext): void {
  if (!context.exports) context.exports = {};

  for (const exportNode of exports) {
    for (const name of exportNode.names) {
      const value = context.bindings[name.name];
      if (!value) {
        runtimeError(context, `Cannot export unknown binding "${name.name}".`);
        continue;
      }
      context.exports[name.name] = value;
    }
  }
}

function runtimeError(context: V3RuntimeContext, message: string): void {
  context.diagnostics.push({
    severity: "error",
    message,
  });
}

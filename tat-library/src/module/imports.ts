import type { BindingNode, ImportNode, ProgramNode } from "../ast/nodes.js";
import type { V3RuntimeContext, V3RuntimeResult } from "../runtime/context.js";

type RunModuleSource = (source: string, options?: V3RuntimeContext["options"]) => V3RuntimeResult;

export function importModules(
  imports: ImportNode[],
  program: ProgramNode,
  context: V3RuntimeContext,
  runSource: RunModuleSource,
): void {
  if (imports.length === 0) return;

  const resolver = context.options?.moduleResolver;
  if (!resolver) {
    runtimeError(context, "A module resolver is required to import TAT modules.");
    return;
  }

  const localBindings = new Set(
    program.body
      .filter((node): node is BindingNode => node.kind === "Binding")
      .map((node) => node.name.name),
  );

  for (const importNode of imports) {
    const importPath = importNode.from.value;
    const resolvedPath = resolver.resolvePath
      ? resolver.resolvePath(importPath, context.options?.currentFile)
      : importPath;
    const moduleResult = executeImportedModule(resolvedPath, importPath, context, runSource);
    if (!moduleResult) continue;

    for (const imported of importNode.imports) {
      const name = imported.name;
      if (localBindings.has(name) || context.bindings[name]) {
        runtimeError(context, `Imported binding "${name}" conflicts with local binding.`);
        continue;
      }

      const value = moduleResult.exports[name];
      if (!value) {
        runtimeError(context, `Module "${importPath}" does not export "${name}".`);
        continue;
      }

      context.bindings[name] = value;
      if (value.type === "graph") {
        context.graphs[name] = value;
      }
    }
  }
}

function executeImportedModule(
  resolvedPath: string,
  importPath: string,
  context: V3RuntimeContext,
  runSource: RunModuleSource,
): V3RuntimeResult | undefined {
  const resolver = context.options?.moduleResolver;
  if (!resolver) return undefined;
  const options = context.options;
  if (!options) return undefined;

  const cache = options.moduleCache ?? new Map<string, V3RuntimeResult>();
  options.moduleCache = cache;

  if (cache.has(resolvedPath)) {
    return cache.get(resolvedPath);
  }

  const stack = options.importStack ?? [];
  const currentFile = options.currentFile;
  const activeStack = currentFile && stack[stack.length - 1] !== currentFile ? [...stack, currentFile] : stack;
  if (activeStack.includes(resolvedPath)) {
    runtimeError(context, `Circular TAT import detected: ${[...activeStack, resolvedPath].join(" -> ")}.`);
    return undefined;
  }

  let source: string;
  try {
    source = resolver.readModule(resolvedPath, currentFile);
  } catch (error) {
    const message = error instanceof Error ? error.message : `Unable to read module "${importPath}".`;
    runtimeError(context, message);
    return undefined;
  }

  const result = runSource(source, {
    ...context.options,
    currentFile: resolvedPath,
    moduleCache: cache,
    importStack: [...activeStack, resolvedPath],
  });
  cache.set(resolvedPath, result);
  context.diagnostics.push(...result.diagnostics);

  return result;
}

function runtimeError(context: V3RuntimeContext, message: string): void {
  context.diagnostics.push({
    severity: "error",
    message,
  });
}

import type { BindingNode, DirectiveNode, ExportNode, FlowNode, ImportNode, ProgramNode } from "../../ast/nodes.js";
import { collectExports } from "../../module/exports.js";
import { importModules } from "../../module/imports.js";
import { validateV3Program } from "../../validator/validateProgram.js";
import { isReadDirective, isSeedDirective } from "../bindings/classifyBinding.js";
import { evaluateReadBinding } from "../bindings/evaluateReadBinding.js";
import { evaluateTopLevelBinding } from "../bindings/evaluateTopLevelBinding.js";
import type { V3RuntimeContext, V3RuntimeOptions, V3RuntimeResult } from "../context.js";
import { executeSeedBinding } from "../directives/seed.js";
import { createWhenListener } from "../directives/when.js";
import { evaluateFlowBinding } from "../flow/evaluateFlowBinding.js";
import { createResult } from "./createResult.js";
import { runV3Source } from "./runSource.js";

export function runV3Program(program: ProgramNode, options: V3RuntimeOptions = {}): V3RuntimeResult {
  const validation = validateV3Program(program);
  const context: V3RuntimeContext = {
    bindings: {},
    graphs: {},
    bridges: {},
    networks: {},
    projections: {},
    events: [],
    diagnostics: [...validation.diagnostics],
    options,
    whenListeners: [],
    triggerDepth: 0,
    exports: {},
  };

  if (!validation.valid) {
    return createResult(context);
  }

  const graphBindings: BindingNode[] = [];
  const readBindings: BindingNode[] = [];
  const flowBindings: BindingNode[] = [];
  const imports: ImportNode[] = [];
  const exports: ExportNode[] = [];

  for (const statement of program.body) {
    if (statement.kind === "Import") {
      imports.push(statement);
      continue;
    }

    if (statement.kind === "Export") {
      exports.push(statement);
      continue;
    }

    if (statement.kind === "Directive" && statement.name === "when") {
      context.whenListeners?.push(createWhenListener(statement));
      continue;
    }

    if (statement.kind !== "Binding") continue;

    if (isSeedDirective(statement.value)) {
      graphBindings.push(statement);
      continue;
    }

    if (isReadDirective(statement.value)) {
      readBindings.push(statement);
      continue;
    }

    if (statement.value.kind === "Flow") {
      flowBindings.push(statement);
      continue;
    }

    const value = evaluateTopLevelBinding(statement);
    context.bindings[statement.name.name] = value;
    if (value.type === "bridge") {
      context.bridges[statement.name.name] = value;
    }
  }

  importModules(imports, program, context, runV3Source);

  for (const binding of graphBindings) {
    const seeded = executeSeedBinding(binding, binding.value as DirectiveNode, context);
    context.bindings[binding.name.name] = seeded;
    if (seeded.type === "graph") {
      context.graphs[binding.name.name] = seeded;
    } else {
      context.networks[binding.name.name] = seeded;
    }
  }

  for (const binding of readBindings) {
    context.bindings[binding.name.name] = evaluateReadBinding(binding, context);
  }

  for (const binding of flowBindings) {
    context.bindings[binding.name.name] = evaluateFlowBinding(binding, binding.value as FlowNode, context);
  }

  collectExports(exports, context);

  return createResult(context);
}

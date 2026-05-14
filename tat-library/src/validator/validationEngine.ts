import { parseV3Program } from "../parser/parseProgram";
import type {
  ArrayNode,
  AssignmentNode,
  BindingNode,
  DirectiveNode,
  ExpressionNode,
  FlowBodyNode,
  FlowNode,
  FlowStepNode,
  GateNode,
  IdentifierNode,
  InvocationNode,
  LiteralNode,
  NodeDefinitionNode,
  ObjectEntryNode,
  ObjectMemberNode,
  ObjectNode,
  PathNode,
  ProgramNode,
  ProjectionChainNode,
  RelationshipNode,
  TatNode,
} from "../ast/nodes.js";
import type { SourceSpan } from "../diagnostics/sourceSpan.js";
import {
  ACTION_FORBIDDEN_DIRECTIVES,
  ACTIVE_DIRECTIVES,
  ALLOWED_DOMAINS,
  CONDITION_KEYS,
  DOMAIN_DIRECTIVES,
  EXPLANATION_DIRECTIVES,
  EXPLANATION_INCLUDES,
  MUTATION_DOMAINS,
  MUTATION_FLOW_DIRECTIVES,
  PLURAL_DOMAIN_SUGGESTIONS,
  PROJECT_FORBIDDEN_DIRECTIVES,
  PROJECTION_FLOW_DIRECTIVES,
  PURE_EXPRESSION_FORBIDDEN_DIRECTIVES,
  QUERY_FORBIDDEN_DIRECTIVES,
  READ_ONLY_GATE_DIRECTIVES,
  SEED_FORBIDDEN_DIRECTIVES,
  GRAPH_SEED_KEYS,
  NETWORK_SEED_KEYS,
  SEED_KEYS,
  TRAVERSE_KEYS,
  UPDATE_DOMAINS,
} from "./domains.js";

export type V3DiagnosticSeverity = "error" | "warning";

export interface V3Diagnostic {
  severity: V3DiagnosticSeverity;
  message: string;
  source?: SourceSpan;
}

export type V3SymbolKind =
  | "node"
  | "edge"
  | "action"
  | "projection"
  | "graph"
  | "traversal"
  | "match"
  | "value"
  | "unknown";

export interface V3SymbolInfo {
  name: string;
  symbolKind: V3SymbolKind;
  node: BindingNode;
  scope: "module";
}

export type V3SymbolTable = Map<string, V3SymbolInfo>;

export interface V3ValidationResult {
  valid: boolean;
  diagnostics: V3Diagnostic[];
  symbols: V3SymbolTable;
}

let activeFlowDirectiveContext = new WeakMap<DirectiveNode, FlowStepNode["operator"]>();

export function validateV3Source(source: string): V3ValidationResult {
  try {
    const program = parseV3Program(source);
    return validateV3Program(program);
  } catch (error) {
    return {
      valid: false,
      diagnostics: [
        {
          severity: "error",
          message: error instanceof Error ? error.message : "Unable to parse TAT v3 source.",
        },
      ],
      symbols: new Map(),
    };
  }
}

export function validateV3Program(program: ProgramNode): V3ValidationResult {
  const diagnostics: V3Diagnostic[] = [];
  const symbols: V3SymbolTable = new Map();

  for (const node of program.body) {
    if (node.kind === "Binding") {
      addBindingSymbol(node, symbols, diagnostics);
    }

    if (node.kind === "Assignment") {
      diagnostics.push({
        severity: "error",
        message: 'Top-level semantic bindings must use ":=".',
        source: node.source,
      });
    }
  }

  const previousFlowDirectiveContext = activeFlowDirectiveContext;
  activeFlowDirectiveContext = collectFlowDirectiveContexts(program);
  try {
    visitNode(program, diagnostics);
  } finally {
    activeFlowDirectiveContext = previousFlowDirectiveContext;
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
    symbols,
  };
}

function addBindingSymbol(
  node: BindingNode,
  symbols: V3SymbolTable,
  diagnostics: V3Diagnostic[],
): void {
  const name = node.name.name;

  if (symbols.has(name)) {
    diagnostics.push({
      severity: "error",
      message: `Duplicate semantic binding "${name}".`,
      source: node.name.source,
    });
    return;
  }

  symbols.set(name, {
    name,
    symbolKind: inferSymbolKind(node.value),
    node,
    scope: "module",
  });
}

function inferSymbolKind(value: TatNode): V3SymbolKind {
  if (value.kind === "NodeDefinition") return "node";
  if (value.kind === "Relationship" && value.relationshipKind === "edge") return "edge";

  if (value.kind === "Directive") {
    if (value.name === "action") return "action";
    if (value.name === "project") return "projection";
    if (value.name === "seed") return getFirstIdentifierArg(value) === "network" ? "value" : "graph";
    if (value.name === "traverse") return "traversal";
    if (value.name === "match") return "match";
    return "value";
  }

  if (value.kind === "Expression" || value.kind === "Literal" || value.kind === "Array") {
    return "value";
  }

  return "unknown";
}

function visitNode(node: TatNode, diagnostics: V3Diagnostic[]): void {
  switch (node.kind) {
    case "Program":
      node.body.forEach((child) => visitNode(child, diagnostics));
      break;
    case "Binding":
      visitNode(node.value, diagnostics);
      break;
    case "NodeDefinition":
      visitObject(node.body, diagnostics);
      break;
    case "Directive":
      validateDirective(node, diagnostics);
      node.args.forEach((arg) => visitNode(arg, diagnostics));
      if (node.body) visitDirectiveBody(node.body, diagnostics);
      break;
    case "Flow":
      validateProjectionUniqueness(node, diagnostics);
      visitNode(node.sourceNode, diagnostics);
      node.steps.forEach((step) => visitFlowStep(step, diagnostics));
      break;
    case "Gate":
      if (node.condition) visitNode(node.condition, diagnostics);
      break;
    case "FlowBody":
      validateProjectionUniqueness(node, diagnostics);
      node.steps.forEach((step) => visitFlowStep(step, diagnostics));
      break;
    case "ProjectionChain":
      visitProjectionChain(node, diagnostics);
      break;
    case "Invocation":
      node.args.forEach((arg) => visitNode(arg, diagnostics));
      break;
    case "Assignment":
      visitNode(node.value, diagnostics);
      break;
    case "Object":
      visitObject(node, diagnostics);
      break;
    case "ObjectEntry":
      visitNode(node.value, diagnostics);
      break;
    case "Array":
      node.items.forEach((item) => visitNode(item, diagnostics));
      break;
    case "Relationship":
      if (node.relationshipKind === "graph" && node.body) visitObject(node.body, diagnostics);
      break;
    case "Expression":
      visitExpression(node, diagnostics);
      break;
    case "Import":
    case "Export":
    case "Identifier":
    case "Literal":
    case "Path":
      break;
  }
}

function visitDirectiveBody(node: ObjectNode | FlowBodyNode, diagnostics: V3Diagnostic[]): void {
  if (node.kind === "Object") {
    visitObject(node, diagnostics);
    return;
  }

  validateProjectionUniqueness(node, diagnostics);
  node.steps.forEach((step) => visitFlowStep(step, diagnostics));
}

function validateDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  if (!ACTIVE_DIRECTIVES.has(node.name)) {
    diagnostics.push({
      severity: "error",
      message: `Unknown TAT directive "@${node.name}".`,
      source: node.source,
    });
  }

  if (DOMAIN_DIRECTIVES.has(node.name)) {
    validateDomainArgument(node, diagnostics);
  }

  if (node.name === "inject" && activeFlowDirectiveContext.get(node) !== "<-") {
    diagnostics.push({
      severity: "error",
      message: '@inject(...) must be used in injection flow with "<-".',
      source: node.source,
    });
  }

  if (EXPLANATION_DIRECTIVES.has(node.name) && activeFlowDirectiveContext.get(node) !== "<>") {
    diagnostics.push({
      severity: "error",
      message: `@${node.name}() must be used in projection flow with "<>".`,
      source: node.source,
    });
  }

  switch (node.name) {
    case "seed":
      validateSeedDirective(node, diagnostics);
      break;
    case "query":
      validateQueryDirective(node, diagnostics);
      break;
    case "derive":
      validateDeriveDirective(node, diagnostics);
      break;
    case "graft":
      validateGraftDirective(node, diagnostics);
      break;
    case "prune":
      validatePruneDirective(node, diagnostics);
      break;
    case "update":
      validateUpdateDirective(node, diagnostics);
      break;
    case "traverse":
      validateTraverseDirective(node, diagnostics);
      break;
    case "match":
      validateMatchDirective(node, diagnostics);
      break;
    case "action":
      validateActionDirective(node, diagnostics);
      break;
    case "project":
      validateProjectDirective(node, diagnostics);
      break;
    case "inject":
      validateInjectDirective(node, diagnostics);
      break;
    case "repeat":
      validateRepeatDirective(node, diagnostics);
      break;
    case "when":
      validateWhenDirective(node, diagnostics);
      break;
    case "who":
    case "what":
    case "why":
    case "how":
      validateExplanationDirective(node, diagnostics);
      break;
  }
}

function validateDomainArgument(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  const domainArg = node.args[0];
  if (!domainArg || domainArg.kind !== "Identifier") return;

  const domain = domainArg.name;
  if (ALLOWED_DOMAINS.has(domain)) return;

  const singular = PLURAL_DOMAIN_SUGGESTIONS.get(domain);
  if (singular) {
    diagnostics.push({
      severity: "error",
      message: `Use singular domain "${singular}" instead of "${domain}".`,
      source: domainArg.source,
    });
  }
}

function validateSeedDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  validateExactArgCount(node, 1, "@seed(domain) requires exactly one domain argument.", diagnostics);
  validateDomainAllowed(node, new Set(["graph", "network"]), diagnostics);
  const body = requireObjectBody(node, "@seed(domain) requires a body.", diagnostics);
  if (!body) return;

  const domain = getFirstIdentifierArg(node) ?? "graph";
  const allowedKeys = domain === "network" ? NETWORK_SEED_KEYS : GRAPH_SEED_KEYS;
  validateAllowedBodyKeys(body, allowedKeys, `@seed(${domain})`, diagnostics);

  const requiredKey = domain === "network" ? "anchor" : "root";
  if (!findObjectEntry(body, requiredKey)) {
    diagnostics.push({
      severity: "error",
      message: domain === "network" ? `@seed(network) requires an anchor value.` : "@seed(graph) requires a root value.",
      source: node.source,
    });
  }

  reportForbiddenDirectives(body, SEED_FORBIDDEN_DIRECTIVES, `@seed(${domain})`, diagnostics);

  if (containsFlow(body)) {
    diagnostics.push({
      severity: "error",
      message: `@seed(${domain}) may not contain flow operators.`,
      source: body.source,
    });
  }
}

function validateQueryDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  validateExactArgCount(node, 1, "@query(domain) requires exactly one domain argument.", diagnostics);
  validateDomainAllowed(node, ALLOWED_DOMAINS, diagnostics);
  const body = requireObjectBody(node, "@query(...) should have a body.", diagnostics);
  if (!body) return;

  reportForbiddenDirectives(body, QUERY_FORBIDDEN_DIRECTIVES, "@query()", diagnostics);
}

function validateDeriveDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  validateExactArgCount(node, 1, "@derive(domain) requires exactly one domain argument.", diagnostics);
  validateDomainAllowed(node, ALLOWED_DOMAINS, diagnostics);
  const body = requireObjectBody(node, "@derive(domain) requires a body.", diagnostics);
  if (!body) return;

  if (!findObjectEntry(body, "target")) {
    diagnostics.push({
      severity: "error",
      message: "@derive(domain) requires a target value.",
      source: node.source,
    });
  }

  const formula = findObjectEntry(body, "formula");
  if (!formula) {
    diagnostics.push({
      severity: "error",
      message: "@derive(domain) requires a formula value.",
      source: node.source,
    });
  } else {
    reportForbiddenDirectives(formula.value, PURE_EXPRESSION_FORBIDDEN_DIRECTIVES, "@derive(...).formula", diagnostics);
  }
}

function validateGraftDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  validateExactArgCount(node, 1, "@graft(domain) requires exactly one domain argument.", diagnostics);
  validateDomainAllowed(node, MUTATION_DOMAINS, diagnostics);
  const body = requireObjectBody(node, "@graft(...) requires a body.", diagnostics);
  if (!body) return;

  validateNoConditionKeys(body, "@graft(...)", diagnostics);
}

function validatePruneDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  validateExactArgCount(node, 1, "@prune(domain) requires exactly one domain argument.", diagnostics);
  validateDomainAllowed(node, MUTATION_DOMAINS, diagnostics);
  const body = requireObjectBody(node, "@prune(...) requires a body.", diagnostics);
  if (!body) return;

  validateNoConditionKeys(body, "@prune(...)", diagnostics);
}

function validateUpdateDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  validateExactArgCount(node, 1, "@update(domain) requires exactly one domain argument.", diagnostics);
  validateDomainAllowed(node, UPDATE_DOMAINS, diagnostics);
  const body = requireObjectBody(node, "@update(...) requires a body.", diagnostics);
  if (!body) return;

  validateNoConditionKeys(body, "@update(...)", diagnostics);

  for (const entry of body.entries) {
    if (entry.kind === "ObjectEntry" && keyName(entry.key) === "updates") {
      const domain = getFirstIdentifierArg(node) ?? "domain";
      diagnostics.push({
        severity: "error",
        message: `@update(${domain}) uses direct assignments. Remove the updates: [] wrapper.`,
        source: entry.source,
      });
      continue;
    }

    if (entry.kind !== "Assignment") {
      diagnostics.push({
        severity: "error",
        message: '@update(...) body entries must be direct assignments using "=".',
        source: entry.source,
      });
    }
  }
}

function validateTraverseDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  validateExactArgCount(node, 1, "@traverse(domain) requires exactly one domain argument.", diagnostics);
  validateDomainAllowed(node, new Set(["graph", "network"]), diagnostics);
  const body = requireObjectBody(node, "@traverse(domain) requires a body.", diagnostics);
  if (!body) return;

  validateAllowedBodyKeys(body, new Set([...TRAVERSE_KEYS, "target"]), "@traverse(domain)", diagnostics);

  if (!findObjectEntry(body, "target")) {
    diagnostics.push({
      severity: "error",
      message: "@traverse(domain) requires a target value.",
      source: node.source,
    });
  }

  for (const key of ["from", "to"] as const) {
    if (!findObjectEntry(body, key)) {
      diagnostics.push({
        severity: "error",
        message: `@traverse(domain) requires a "${key}" value.`,
        source: node.source,
      });
    }
  }

  for (const key of ["depth", "limit"] as const) {
    const entry = findObjectEntry(body, key);
    if (entry && isNumberLiteral(entry.value) && (!Number.isFinite(entry.value.value) || entry.value.value <= 0)) {
      diagnostics.push({
        severity: "error",
        message: `@traverse(domain) "${key}" must be a positive number.`,
        source: entry.value.source,
      });
    }
  }

  const returnEntry = findObjectEntry(body, "return");
  const returnValue = returnEntry ? valueName(returnEntry.value) : undefined;
  if (returnValue && returnValue !== "first" && returnValue !== "all") {
    diagnostics.push({
      severity: "error",
      message: '@traverse(domain) return value must be "first" or "all".',
      source: returnEntry?.value.source,
    });
  }
}

function validateMatchDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  validateExactArgCount(node, 1, "@match(domain) requires exactly one return-domain argument.", diagnostics);
  validateDomainAllowed(node, ALLOWED_DOMAINS, diagnostics);
  const body = requireObjectBody(node, "@match(domain) requires a body.", diagnostics);
  if (!body) return;

  const whereEntry = findObjectEntry(body, "where");
  if (!whereEntry) {
    const domain = getFirstIdentifierArg(node) ?? "domain";
    diagnostics.push({
      severity: "error",
      message: `@match(${domain}) requires a where block.`,
      source: node.source,
    });
    return;
  }

  reportForbiddenDirectives(whereEntry.value, QUERY_FORBIDDEN_DIRECTIVES, "@match() where", diagnostics);
}

function validateActionDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  validateExactArgCount(node, 1, "@action(domain) requires exactly one domain argument.", diagnostics);
  validateDomainAllowed(node, new Set(["graph", "network"]), diagnostics);

  const body = requireAnyBody(node, "@action(domain) requires a body.", diagnostics);
  if (!body) return;

  if (containsBinding(body)) {
    diagnostics.push({
      severity: "error",
      message: "Top-level bindings are not allowed inside @action(...).",
      source: body.source,
    });
  }

  reportForbiddenDirectives(body, ACTION_FORBIDDEN_DIRECTIVES, "@action()", diagnostics);
}

function validateProjectDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  validateExactArgCount(node, 1, "@project(domain) requires exactly one domain argument.", diagnostics);
  validateDomainAllowed(node, new Set(["graph", "network"]), diagnostics);
  requireObjectBody(node, "@project(domain) requires a body.", diagnostics);
  collectDirectives(node, (directive) => {
    if (directive === node || !PROJECT_FORBIDDEN_DIRECTIVES.has(directive.name)) return;

    diagnostics.push({
      severity: "error",
      message: "Mutation directives are not allowed inside @project(...).",
      source: directive.source,
    });
  });
}

function validateInjectDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  if (node.args.length !== 2) {
    diagnostics.push({
      severity: "error",
      message: "@inject(...) requires hookRef and fileName arguments.",
      source: node.source,
    });
  }

  const fileName = node.args[1];
  if (fileName && !(fileName.kind === "Literal" && fileName.literalKind === "string")) {
    diagnostics.push({
      severity: "error",
      message: "@inject(...) fileName must be a string literal.",
      source: fileName.source,
    });
  }
}

function validateRepeatDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  validateExactArgCount(node, 1, "@repeat(domain) requires exactly one domain argument.", diagnostics);
  validateDomainAllowed(node, new Set(["graph", "network"]), diagnostics);

  const body = requireObjectBody(node, "@repeat(domain) requires a body.", diagnostics);
  if (!body) return;

  for (const key of ["target", "maxIterations", "while", "over", "action"] as const) {
    if (!findObjectEntry(body, key)) {
      diagnostics.push({
        severity: "error",
        message: `@repeat(domain) requires a ${key} value.`,
        source: node.source,
      });
    }
  }

  const maxIterations = findObjectEntry(body, "maxIterations")?.value;
  if (maxIterations && isNumberLiteral(maxIterations) && (!Number.isFinite(maxIterations.value) || maxIterations.value <= 0)) {
    diagnostics.push({
      severity: "error",
      message: "@repeat(domain) maxIterations must be a positive number.",
      source: maxIterations.source,
    });
  }
}

function validateWhenDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  validateExactArgCount(node, 1, "@when(domain) requires exactly one domain argument.", diagnostics);
  validateDomainAllowed(node, new Set(["graph", "network", "state", "meta"]), diagnostics);

  const body = requireObjectBody(node, "@when(domain) requires a body.", diagnostics);
  if (!body) return;

  for (const key of ["target", "condition", "action"] as const) {
    if (!findObjectEntry(body, key)) {
      diagnostics.push({
        severity: "error",
        message: `@when(domain) requires a ${key} value.`,
        source: node.source,
      });
    }
  }
}

function validateExplanationDirective(node: DirectiveNode, diagnostics: V3Diagnostic[]): void {
  const includes = EXPLANATION_INCLUDES[node.name as keyof typeof EXPLANATION_INCLUDES];
  if (!includes || node.body?.kind !== "Object") return;

  const includeEntry = findObjectEntry(node.body, "include");
  if (!includeEntry || includeEntry.value.kind !== "Array") return;

  for (const item of includeEntry.value.items) {
    const includeValue = valueName(item);
    if (includeValue && !includes.has(includeValue)) {
      diagnostics.push({
        severity: "error",
        message: `Invalid @${node.name}() include value "${includeValue}".`,
        source: item.source,
      });
    }
  }
}

function validateExactArgCount(
  node: DirectiveNode,
  expected: number,
  message: string,
  diagnostics: V3Diagnostic[],
): void {
  if (node.args.length === expected) return;

  diagnostics.push({
    severity: "error",
    message,
    source: node.source,
  });
}

function validateDomainAllowed(
  node: DirectiveNode,
  allowedDomains: ReadonlySet<string>,
  diagnostics: V3Diagnostic[],
): void {
  const domainArg = node.args[0];
  if (!domainArg || domainArg.kind !== "Identifier") return;

  const domain = domainArg.name;
  if (allowedDomains.has(domain)) return;
  if (PLURAL_DOMAIN_SUGGESTIONS.has(domain)) return;

  diagnostics.push({
    severity: "error",
    message: `Unknown domain "${domain}" for @${node.name}(...).`,
    source: domainArg.source,
  });
}

function requireObjectBody(
  node: DirectiveNode,
  message: string,
  diagnostics: V3Diagnostic[],
): ObjectNode | undefined {
  if (node.body?.kind === "Object") return node.body;

  diagnostics.push({
    severity: "error",
    message,
    source: node.source,
  });
  return undefined;
}

function requireAnyBody(
  node: DirectiveNode,
  message: string,
  diagnostics: V3Diagnostic[],
): ObjectNode | FlowBodyNode | undefined {
  if (node.body) return node.body;

  diagnostics.push({
    severity: "error",
    message,
    source: node.source,
  });
  return undefined;
}

function validateAllowedBodyKeys(
  body: ObjectNode,
  allowedKeys: ReadonlySet<string>,
  directiveLabel: string,
  diagnostics: V3Diagnostic[],
): void {
  for (const entry of body.entries) {
    if (entry.kind !== "ObjectEntry") continue;

    const key = keyName(entry.key);
    if (key && !allowedKeys.has(key)) {
      diagnostics.push({
        severity: "error",
        message: `${directiveLabel} body key "${key}" is not allowed.`,
        source: entry.source,
      });
    }
  }
}

function validateNoConditionKeys(
  body: ObjectNode,
  directiveLabel: string,
  diagnostics: V3Diagnostic[],
): void {
  for (const entry of body.entries) {
    if (entry.kind !== "ObjectEntry") continue;

    const key = keyName(entry.key);
    if (key && CONDITION_KEYS.has(key)) {
      diagnostics.push({
        severity: "error",
        message: `Conditions belong in flow gates, not inside ${directiveLabel}.`,
        source: entry.source,
      });
    }
  }
}

function visitFlowStep(step: FlowStepNode, diagnostics: V3Diagnostic[]): void {
  if (step.kind === "Gate") {
    validateGateStep(step, diagnostics);
    visitNode(step, diagnostics);
    return;
  }

  validateFlowStep(step, diagnostics);
  visitNode(step.value, diagnostics);
}

function visitProjectionChain(node: ProjectionChainNode, diagnostics: V3Diagnostic[]): void {
  visitNode(node.sourceNode, diagnostics);
  for (const step of [node.mainProjection, node.who, node.what, node.why, node.how]) {
    if (step) visitFlowStep(step, diagnostics);
  }
}

function validateFlowStep(step: Exclude<FlowStepNode, GateNode>, diagnostics: V3Diagnostic[]): void {
  if (step.operator === "<-") {
    if (step.value.kind !== "Directive" || step.value.name !== "inject") {
      diagnostics.push({
        severity: "error",
        message: 'Injection flow "<-" only accepts @inject(...).',
        source: step.source,
      });
      return;
    }

    return;
  }

  if (step.operator === "->") {
    if (step.value.kind === "Directive" && !MUTATION_FLOW_DIRECTIVES.has(step.value.name)) {
      diagnostics.push({
        severity: "error",
        message:
          step.value.name === "query"
            ? "@query(...) is read-only and cannot be used in mutation flow."
            : `@${step.value.name}(...) cannot be used in mutation flow.`,
        source: step.value.source,
      });
    }
    return;
  }

  if (step.value.kind === "Directive" && !PROJECTION_FLOW_DIRECTIVES.has(step.value.name)) {
    diagnostics.push({
      severity: "error",
      message: `@${step.value.name}(...) cannot be used in projection flow.`,
      source: step.value.source,
    });
  }
}

function validateGateStep(step: GateNode, diagnostics: V3Diagnostic[]): void {
  if ((step.operator === "?>" || step.operator === "!>") && !step.condition) {
    diagnostics.push({
      severity: "error",
      message: `${step.operator} requires a condition.`,
      source: step.source,
    });
    return;
  }

  if (
    step.condition?.kind === "Directive" &&
    !READ_ONLY_GATE_DIRECTIVES.has(step.condition.name)
  ) {
    diagnostics.push({
      severity: "error",
      message: "Mutation directives cannot be used as gate conditions.",
      source: step.condition.source,
    });
  }
}

function validateProjectionUniqueness(node: FlowNode | FlowBodyNode, diagnostics: V3Diagnostic[]): void {
  let mainProjectionSeen = false;
  const explanationSeen = new Set<string>();

  for (const step of node.steps) {
    if (step.kind === "Gate" || step.operator !== "<>") continue;

    if (step.value.kind === "Directive" && EXPLANATION_DIRECTIVES.has(step.value.name)) {
      if (explanationSeen.has(step.value.name)) {
        diagnostics.push({
          severity: "error",
          message: `A projection chain may contain only one @${step.value.name}() projection.`,
          source: step.value.source,
        });
      }
      explanationSeen.add(step.value.name);
      continue;
    }

    if (mainProjectionSeen) {
      diagnostics.push({
        severity: "error",
        message: "A projection chain may contain only one main projection.",
        source: step.source,
      });
    }
    mainProjectionSeen = true;
  }
}

function visitObject(node: ObjectNode, diagnostics: V3Diagnostic[]): void {
  node.entries.forEach((entry) => visitObjectMember(entry, diagnostics));
}

function visitObjectMember(node: ObjectMemberNode, diagnostics: V3Diagnostic[]): void {
  if (node.kind === "ObjectEntry" || node.kind === "Assignment") {
    visitNode(node, diagnostics);
  }
}

function visitExpression(node: ExpressionNode, diagnostics: V3Diagnostic[]): void {
  if (node.expressionKind === "binary" || node.expressionKind === "comparison") {
    if (node.left) visitNode(node.left, diagnostics);
    visitNode(node.right, diagnostics);
    return;
  }

  if (node.expressionKind === "unary") {
    visitNode(node.value, diagnostics);
    return;
  }

  if (node.expressionKind === "ternary") {
    visitNode(node.condition, diagnostics);
    visitNode(node.whenTrue, diagnostics);
    visitNode(node.whenFalse, diagnostics);
    return;
  }

  node.args.forEach((arg) => visitNode(arg, diagnostics));
}

function findObjectEntry(body: ObjectNode, key: string): ObjectEntryNode | undefined {
  return body.entries.find(
    (entry): entry is ObjectEntryNode => entry.kind === "ObjectEntry" && keyName(entry.key) === key,
  );
}

function keyName(key: IdentifierNode | PathNode | LiteralNode): string | undefined {
  if (key.kind === "Identifier") return key.name;
  if (key.kind === "Path") return key.parts.map((part) => part.name).join(".");
  if (key.literalKind === "string") return key.value;
  return undefined;
}

function valueName(node: TatNode): string | undefined {
  if (node.kind === "Identifier") return node.name;
  if (node.kind === "Literal" && node.literalKind === "string") return node.value;
  return undefined;
}

function getFirstIdentifierArg(node: DirectiveNode): string | undefined {
  const arg = node.args[0];
  return arg?.kind === "Identifier" ? arg.name : undefined;
}

function isNumberLiteral(node: TatNode): node is LiteralNode & { literalKind: "number"; value: number } {
  return node.kind === "Literal" && node.literalKind === "number";
}

function reportForbiddenDirectives(
  node: TatNode | ObjectNode | FlowBodyNode,
  forbiddenDirectives: ReadonlySet<string>,
  contextLabel: string,
  diagnostics: V3Diagnostic[],
  options: { skipRoot?: boolean } = {},
): void {
  collectDirectives(node, (directive) => {
    if (options.skipRoot && directive === node) return;
    if (!forbiddenDirectives.has(directive.name)) return;

    diagnostics.push({
      severity: "error",
      message: `@${directive.name}(...) is not allowed inside ${contextLabel}.`,
      source: directive.source,
    });
  });
}

function containsBinding(node: TatNode | ObjectNode | FlowBodyNode): boolean {
  let found = false;
  walkValidationTree(node, (current) => {
    if (current.kind === "Binding") {
      found = true;
    }
  });
  return found;
}

function collectFlowDirectiveContexts(program: ProgramNode): WeakMap<DirectiveNode, FlowStepNode["operator"]> {
  const contexts = new WeakMap<DirectiveNode, FlowStepNode["operator"]>();

  walkValidationTree(program, (node) => {
    if (node.kind !== "Flow" && node.kind !== "FlowBody") return;

    const steps = node.kind === "Flow" ? node.steps : node.steps;
    for (const step of steps) {
      if (step.kind !== "Gate" && step.value.kind === "Directive") {
        contexts.set(step.value, step.operator);
      }
    }
  });

  return contexts;
}

function containsFlow(node: TatNode | ObjectNode | FlowBodyNode): boolean {
  let found = false;
  walkValidationTree(node, (current) => {
    if (current.kind === "Flow") {
      found = true;
    }
  });
  return found;
}

function collectDirectives(
  node: TatNode | ObjectNode | FlowBodyNode,
  onDirective: (directive: DirectiveNode) => void,
): void {
  walkValidationTree(node, (current) => {
    if (current.kind === "Directive") {
      onDirective(current);
    }
  });
}

function walkValidationTree(
  node: TatNode | ObjectNode | FlowBodyNode,
  visit: (node: TatNode) => void,
): void {
  if (node.kind === "Object") {
    for (const entry of node.entries) {
      walkObjectMember(entry, visit);
    }
    return;
  }

  if (node.kind === "FlowBody") {
    visit(node);
    for (const step of node.steps) {
      walkFlowStep(step, visit);
    }
    return;
  }

  visit(node);

  switch (node.kind) {
    case "Program":
      node.body.forEach((child) => walkValidationTree(child, visit));
      break;
    case "Binding":
      walkValidationTree(node.value, visit);
      break;
    case "NodeDefinition":
      walkValidationTree(node.body, visit);
      break;
    case "Directive":
      node.args.forEach((arg) => walkValidationTree(arg, visit));
      if (node.body) walkValidationTree(node.body, visit);
      break;
    case "Flow":
      walkValidationTree(node.sourceNode, visit);
      node.steps.forEach((step) => walkFlowStep(step, visit));
      break;
    case "Gate":
      if (node.condition) walkValidationTree(node.condition, visit);
      break;
    case "ProjectionChain":
      walkValidationTree(node.sourceNode, visit);
      [node.mainProjection, node.who, node.what, node.why, node.how].forEach((step) => {
        if (step) walkFlowStep(step, visit);
      });
      break;
    case "Invocation":
      node.args.forEach((arg) => walkValidationTree(arg, visit));
      break;
    case "Assignment":
      walkValidationTree(node.value, visit);
      break;
    case "ObjectEntry":
      walkValidationTree(node.value, visit);
      break;
    case "Array":
      node.items.forEach((item) => walkValidationTree(item, visit));
      break;
    case "Relationship":
      if (node.relationshipKind === "graph" && node.body) walkValidationTree(node.body, visit);
      break;
    case "Expression":
      if (node.expressionKind === "binary" || node.expressionKind === "comparison") {
        if (node.left) walkValidationTree(node.left, visit);
        walkValidationTree(node.right, visit);
      } else if (node.expressionKind === "unary") {
        walkValidationTree(node.value, visit);
      } else if (node.expressionKind === "ternary") {
        walkValidationTree(node.condition, visit);
        walkValidationTree(node.whenTrue, visit);
        walkValidationTree(node.whenFalse, visit);
      } else {
        node.args.forEach((arg) => walkValidationTree(arg, visit));
      }
      break;
    case "Import":
    case "Export":
    case "Identifier":
    case "Literal":
    case "Path":
      break;
  }
}

function walkObjectMember(node: ObjectMemberNode, visit: (node: TatNode) => void): void {
  if (node.kind === "ObjectEntry" || node.kind === "Assignment") {
    walkValidationTree(node, visit);
  } else {
    visit(node);
  }
}

function walkFlowStep(step: FlowStepNode, visit: (node: TatNode) => void): void {
  if (step.kind === "Gate") {
    walkValidationTree(step, visit);
  } else {
    walkValidationTree(step.value, visit);
  }
}

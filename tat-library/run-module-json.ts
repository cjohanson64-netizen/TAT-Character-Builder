import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { runV3Source } from "./src/runtime";

type JsonRecord = Record<string, unknown>;

function printJson(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function getArgValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function getArgValues(name: string): string[] {
  const values: string[] = [];

  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
    }
  }

  return values;
}

function buildInjectionRegistry(): Record<
  string,
  { fileName: string; run: () => string }
> {
  const injections: Record<string, { fileName: string; run: () => string }> =
    {};

  for (const rawValue of getArgValues("--inject")) {
    const [hookRef, filePath] = rawValue.split("=");

    if (!hookRef || !filePath) {
      continue;
    }

    const absolutePath = resolve(process.cwd(), filePath);

    injections[hookRef] = {
      fileName: extname(absolutePath),
      run: () => readFileSync(absolutePath, "utf8"),
    };
  }

  return injections;
}

function resolveTatImport(importPath: string, currentFile?: string): string {
  const baseDir = currentFile ? dirname(currentFile) : process.cwd();
  const resolvedPath = resolve(baseDir, importPath);

  if (existsSync(resolvedPath)) {
    return resolvedPath;
  }

  if (!extname(resolvedPath)) {
    const withTatExtension = `${resolvedPath}.tat`;

    if (existsSync(withTatExtension)) {
      return withTatExtension;
    }
  }

  return resolvedPath;
}

function readTatModule(resolvedPath: string): string {
  if (!existsSync(resolvedPath)) {
    throw new Error(
      `Unable to read TAT module. File does not exist: ${resolvedPath}`,
    );
  }

  return readFileSync(resolvedPath, "utf8");
}

function filterRecord<T>(
  record: Record<string, T>,
  keyToKeep?: string,
): Record<string, T> {
  if (!keyToKeep) {
    return record;
  }

  const value = record[keyToKeep];

  if (!value) {
    return {};
  }

  return {
    [keyToKeep]: value,
  };
}

function serializeGraphs(
  graphs: Record<string, unknown>,
  graphFilter?: string,
): Record<string, unknown> {
  const filtered = filterRecord(graphs, graphFilter);
  const output: Record<string, unknown> = {};

  for (const [graphName, graph] of Object.entries(filtered)) {
    output[graphName] = serializeGraph(graph);
  }

  return output;
}

function serializeGraph(graph: unknown): unknown {
  if (!graph || typeof graph !== "object") {
    return graph;
  }

  const graphRecord = graph as JsonRecord;

  return {
    type: graphRecord.type,
    id: graphRecord.id,
    root: graphRecord.root,
    nodes: serializeGraphNodes(graphRecord.nodes),
    edges: serializeGraphEdges(graphRecord.edges),
    state: plainValue(graphRecord.state ?? {}),
    meta: plainValue(graphRecord.meta ?? {}),
  };
}

function serializeGraphNodes(nodes: unknown): Record<string, unknown> {
  if (!nodes || typeof nodes !== "object") {
    return {};
  }

  const output: Record<string, unknown> = {};

  for (const [nodeId, nodeValue] of Object.entries(nodes as JsonRecord)) {
    if (!nodeValue || typeof nodeValue !== "object") {
      continue;
    }

    const nodeRecord = nodeValue as JsonRecord;
    const dataSource = nodeRecord.data ?? nodeRecord;

    output[nodeId] = {
      id: nodeRecord.id ?? nodeId,
      data: plainValue(dataSource),
    };
  }

  return output;
}

function serializeGraphEdges(edges: unknown): Record<string, unknown> {
  if (!edges || typeof edges !== "object") {
    return {};
  }

  const output: Record<string, unknown> = {};

  for (const [edgeId, edgeValue] of Object.entries(edges as JsonRecord)) {
    if (!edgeValue || typeof edgeValue !== "object") {
      continue;
    }

    const edgeRecord = edgeValue as JsonRecord;

    output[edgeId] = {
      id: edgeRecord.id ?? edgeId,
      from: plainValue(edgeRecord.from),
      relation: plainValue(edgeRecord.relation),
      to: plainValue(edgeRecord.to),
      explicit: edgeRecord.explicit,
    };
  }

  return output;
}

function plainValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(plainValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as JsonRecord;

  // AST Literal node
  if (record.kind === "Literal" && "value" in record) {
    return record.value;
  }

  // AST Identifier node
  if (record.kind === "Identifier" && typeof record.name === "string") {
    return record.name;
  }

  // AST Object node
  if (record.kind === "Object" && Array.isArray(record.entries)) {
    const output: Record<string, unknown> = {};

    for (const entry of record.entries) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const entryRecord = entry as JsonRecord;
      const key = plainValue(entryRecord.key);

      if (typeof key !== "string") {
        continue;
      }

      output[key] = plainValue(entryRecord.value);
    }

    return output;
  }

  // AST ObjectEntry node
  if (record.kind === "ObjectEntry") {
    return plainValue(record.value);
  }

  const output: Record<string, unknown> = {};

  for (const [key, childValue] of Object.entries(record)) {
    if (
      key === "source" ||
      key === "node" ||
      key === "localBindings" ||
      key === "relationships" ||
      key === "history"
    ) {
      continue;
    }

    output[key] = plainValue(childValue);
  }

  return output;
}

function main() {
  const filePath = process.argv[2];
  const graphFilter = getArgValue("--graph");
  const networkFilter = getArgValue("--network");
  const projectionFilter = getArgValue("--projection");

  if (!filePath) {
    printJson({
      status: "error",
      success: false,
      diagnostics: [
        {
          severity: "error",
          message: "Missing required TAT module path.",
        },
      ],
      usage: "npx tsx tat-library/run-module-json.ts <path-to-file.tat>",
    });

    process.exit(1);
  }

  const absolutePath = resolve(process.cwd(), filePath);

  if (!existsSync(absolutePath)) {
    printJson({
      status: "error",
      success: false,
      diagnostics: [
        {
          severity: "error",
          message: `TAT module not found: ${absolutePath}`,
        },
      ],
      modulePath: absolutePath,
      graphs: {},
      networks: {},
      projections: {},
      exports: {},
      events: [],
    });

    process.exit(1);
  }

  try {
    const source = readFileSync(absolutePath, "utf8");
    const injections = buildInjectionRegistry();

    const result = runV3Source(source, {
      currentFile: absolutePath,

      moduleResolver: {
        resolvePath: resolveTatImport,
        readModule: readTatModule,
      },

      injections,
      moduleCache: new Map(),
      importStack: [],
    });

    const payload = {
      success: result.status === "success",
      status: result.status,
      modulePath: absolutePath,
      diagnostics: result.diagnostics ?? [],
      graphs: serializeGraphs(result.graphs ?? {}, graphFilter),
      networks: filterRecord(result.networks ?? {}, networkFilter),
      projections: filterRecord(result.projections ?? {}, projectionFilter),
      exports: {},
      events: [],
    };

    printJson(payload);

    process.exit(result.status === "success" ? 0 : 1);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error while running TAT module.";

    printJson({
      status: "error",
      success: false,
      modulePath: absolutePath,
      diagnostics: [
        {
          severity: "error",
          message,
        },
      ],
      graphs: {},
      networks: {},
      projections: {},
      exports: {},
      events: [],
    });

    process.exit(1);
  }
}

main();

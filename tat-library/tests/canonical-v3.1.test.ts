import { describe, expect, it } from "vitest";

import { parseV3Program } from "../src/parser/index";
import { runV3Source } from "../src/runtime/index";
import { validateV3Source } from "../src/validator/index";

const canonicalProgram = `
  hero := <node { id: hero, hp: 10 }>
  monster := <node { id: monster, hp: 5 }>
  hookA := <hook { id: hookA, key: "x", direction: "out" }>
  hookB := <hook { id: hookB, key: "x", direction: "in" }>
  ctx := <context { id: ctx, key: "demo" }>
  edge1 := { hero : attacks : monster }

  graph1 := @seed(graph) {
    node: [hero, monster, hookA],
    edge: [edge1],
    state: { hero.hp: 10, monster.hp: 5 },
    meta: { hero.role: actor },
    root: hero,
  }

  graph2 := @seed(graph) {
    node: [hookB],
    edge: [],
    state: {},
    meta: {},
    root: hookB,
  }

  bridge1 := <bridge {
    id: bridge1,
    from: graph1,
    to: graph2,
    context: ctx,
    hooks: [hookA, hookB],
  }>

  network1 := @seed(network) {
    graphs: [graph1, graph2],
    bridges: [bridge1],
    contexts: [ctx],
    hooks: [hookA, hookB],
    state: { bridge1: active },
    meta: { purpose: "demo" },
    anchor: graph1,
  }

  nextHp := @derive(value) {
    target: monster,
    from: [state],
    formula: max(monster.hp - 1, 0),
  }

  projectNetwork := @project(network) {
    format: topology,
  }

  networkView := network1 <> projectNetwork(network1)
`;

function messages(source: string): string[] {
  return validateV3Source(source).diagnostics.map((diagnostic) => diagnostic.message);
}

describe("TAT v3.1 canonical syntax", () => {
  it("parses canonical node-family and bridge entities", () => {
    const program = parseV3Program(`
      node1 := <node { id: node1 }>
      context1 := <context { id: context1, key: "demo" }>
      hook1 := <hook { id: hook1, key: "demo", direction: "out" }>
      bridge1 := <bridge { id: bridge1, from: graph1, to: graph2, context: context1, hooks: [hook1] }>
    `);

    expect(program.body).toHaveLength(4);
  });

  it("validates and runs canonical graph/network syntax", () => {
    expect(validateV3Source(canonicalProgram).valid).toBe(true);
    const result = runV3Source(canonicalProgram);
    expect(result.status).toBe("success");
    expect(result.networks.network1).toMatchObject({ anchor: "graph1", bridges: ["bridge1"] });
    expect(result.projections.project).toMatchObject({ kind: "project", format: "topology", target: "network1" });
  });

  it("rejects retired legacy node literals", () => {
    expect(messages(`node1 := <{ id: node1 }>`).join('\n')).toContain(
      'Legacy node literal "<{ ... }>" is retired. Use "<node { ... }>".',
    );
  });

  it("rejects bare @seed()", () => {
    expect(messages(`graph1 := @seed() { node: [], root: node1 }`)).toContain(
      "@seed(domain) requires exactly one domain argument.",
    );
  });

  it("rejects retired @compute directive", () => {
    expect(messages(`value1 := @compute(max(1, 2))`)).toContain('Unknown TAT directive "@compute".');
  });

  it("requires canonical @derive(domain) body", () => {
    expect(messages(`value1 := @derive(1 + 2)`)).toContain(
      "@derive(domain) requires a body.",
    );
  });

  it("rejects positional @action arguments", () => {
    expect(messages(`action1 := @action(actor, target) { -> @update(state) { target.hp = 1 } }`)).toContain(
      "@action(domain) requires exactly one domain argument.",
    );
  });
});

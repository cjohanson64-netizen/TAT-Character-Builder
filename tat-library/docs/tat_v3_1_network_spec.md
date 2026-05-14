# TAT v3.1 — Network Semantics Specification

## Overview

TAT v3.1 introduces cross-graph semantic topology through the `network` domain.

Graphs remain the primary semantic structures.

Networks organize relationships between graphs.

This allows TAT to model:

```txt
cross-system relationships
concept ecosystems
skill trees
music theory structures
semantic runtime ecosystems
AI-generated topology
````

without flattening graphs into one giant structure.

---

# Core Philosophy

## Graphs

Graphs model local semantic structure.

```txt
nodes
edges
state
meta
root
```

Graphs answer:

```txt
What exists locally?
How are things connected locally?
```

---

## Networks

Networks model cross-graph semantic structure.

```txt
graphs
bridges
contexts
hooks
state
meta
anchor
```

Networks answer:

```txt
How do graphs connect?
Why do graphs interact?
What semantic boundaries are shared?
```

---

# Entity Semantics

## Node Family

The following are semantic node wrappers:

```tat
<node {...}>
<context {...}>
<hook {...}>
```

These are NOT separate AST families.

Internally:

```txt
<node>
<context>
<hook>
```

all normalize to a shared node-family structure with:

```txt
entityType
```

metadata.

Example normalized semantics:

```txt
<node {...}>
  -> entityType: "node"

<context {...}>
  -> entityType: "context"

<hook {...}>
  -> entityType: "hook"
```

This preserves semantic meaning without fragmenting the AST.

---

## `<node {...}>`

Generic semantic node.

Example:

```tat
hero = <node {
  id: "hero",
}>
```

---

## `<context {...}>`

Specialized semantic node representing shared semantic context.

Example:

```tat
tonalCenter = <context {
  id: "tonalCenter",
}>
```

Contexts help determine whether graphs may connect semantically.

---

## `<hook {...}>`

Specialized semantic node representing graph connection boundaries.

Example:

```tat
melodyHook = <hook {
  id: "melodyHook",
  key: "pitch:C",
  direction: "out",
}>
```

Hook directions:

```txt
in
out
both
```

---

## `<bridge {...}>`

Bridge entities are network-level semantic connectors.

Unlike node-family wrappers, bridges are their own semantic structure.

Example:

```tat
melodyHarmonyBridge := <bridge {
  id: "melodyHarmonyBridge",

  from: melodyGraph,
  to: harmonyGraph,

  context: tonalCenter,

  hooks: [
    melodyHook,
    harmonyHook,
  ],
}>
```

Bridges belong to networks, not graphs.

---

# Ownership and Registration

## Declaration vs Ownership

Contexts and hooks are declared like nodes:

```tat
tonalCenter = <context { ... }>
melodyHook = <hook { ... }>
```

Declaration does not imply ownership.

Ownership occurs when entities are added to a graph or network through:

```txt
@seed
@graft
```

---

## Network Registries

Network-level lists are authoritative registries.

Example:

```tat
network1 := @seed(network) {
  hooks: [
    melodyHook,
    harmonyHook,
  ],

  contexts: [
    tonalCenter,
  ],
}
```

Bridge-level references must reference registered entities.

Example:

```tat
bridge1 := <bridge {
  hooks: [melodyHook],
  context: tonalCenter,
}>
```

Rule:

```txt
A bridge may reference only hooks and contexts registered in its network.
```

---

## Bridge References

Bridge hook/context references are references only.

The authoritative ownership lists live at the network level.

Meaning:

```txt
network.hooks
network.contexts
```

are canonical registries.

---

# AST Semantics

## Seed Block Family

Seed blocks dispatch by semantic domain.

```txt
@seed(graph)
  -> GraphSeedBlockNode

@seed(network)
  -> NetworkSeedBlockNode
```

Both belong to the broader semantic seed family.

---

## GraphSeedBlockNode

```ts
interface GraphSeedBlockNode {
  type: "GraphSeedBlock";

  nodes: SeedNodeRefNode[];
  edges: SeedEdgeEntryNode[];

  state: ObjectLiteralNode;
  meta: ObjectLiteralNode;

  root: IdentifierNode;
}
```

---

## NetworkSeedBlockNode

```ts
interface NetworkSeedBlockNode {
  type: "NetworkSeedBlock";

  graphs: IdentifierNode[];

  bridges: IdentifierNode[];

  contexts: IdentifierNode[];

  hooks: IdentifierNode[];

  state: ObjectLiteralNode;
  meta: ObjectLiteralNode;

  anchor: IdentifierNode;
}
```

---

# Runtime Structures

## TATBridge

Runtime bridge representation.

```ts
type TATBridge = {
  id: string;

  from: string;
  to: string;

  context?: string;

  hooks: string[];

  state: Record<string, unknown>;

  meta: Record<string, unknown>;
};
```

Runtime context stores:

```ts
bridges: Map<string, TATBridge>
```

---

## TATNetwork

```ts
type TATNetwork = {
  id: string;

  anchor: string;

  graphs: string[];

  bridges: string[];

  contexts: string[];

  hooks: string[];

  state: Record<string, unknown>;

  meta: Record<string, unknown>;

  history: NetworkHistoryEntry[];
};
```

Runtime context stores:

```ts
networks: Map<string, TATNetwork>
```

Networks store references, not copies.

---

# Network History

Networks maintain provenance history.

This enables:

```txt
@who()
@what()
@why()
@how()
```

to explain network behavior.

---

## NetworkHistoryEntry

```ts
type NetworkHistoryEntry = {
  op:
    | "seed"
    | "graft"
    | "prune"
    | "update"
    | "project";

  target: string;

  added?: Record<string, string[]>;

  removed?: Record<string, string[]>;

  reason?: string;
};
```

Read-only operations are not recorded in history.

---

# Network Structure

Networks are seeded with:

```tat
network1 := @seed(network) {
  graphs: [
    graph1,
    graph2,
  ],

  bridges: [
    bridge1to2,
  ],

  contexts: [
    context1,
  ],

  hooks: [
    hook1,
    hook2,
  ],

  state: {},

  meta: {},

  anchor: graph1,
}
```

---

# Root vs Anchor

Graphs use:

```txt
root
```

Networks use:

```txt
anchor
```

Meaning:

```txt
root
  anchors graph traversal

anchor
  anchors cross-graph topology
```

---

# Directive Semantics

## `@seed(network)`

Creates a network structure.

Seed dispatches by semantic domain:

```txt
@seed(graph)
  -> runtime/entities/graph/createGraph.ts

@seed(network)
  -> runtime/entities/network/createNetwork.ts
```

---

## `@graft(network)`

Adds network topology.

May add:

```txt
graphs
bridges
contexts
hooks
```

---

## `@prune(network)`

Removes network topology.

Initial v3.1 behavior:

```txt
remove explicitly targeted topology
remove directly orphaned bridges/hooks/contexts
only when ownership is unambiguous
```

---

## Prune Ownership Rules

When pruning a bridge:

```txt
remove the bridge

remove hooks referenced only by that bridge

keep hooks referenced by other bridges

keep contexts referenced by other bridges

remove context only if no remaining bridge references it
```

Advanced recursive cleanup is deferred.

---

## `@update(network)`

Updates network-level configuration.

Currently intended primarily for:

```txt
anchor
```

State/meta updates belong to:

```txt
@update(state)
@update(meta)
```

When `target` is a network, state/meta apply to network-level state/meta.

---

# Analytic Directives

## `@query(network)`

Checks network topology existence.

Example:

```tat
@query(network) {
  target: network1,
  bridges: [bridge1to2],
}
```

Returns boolean truth.

---

## `@match(network)`

Returns matching network topology items.

Example:

```tat
@match(network) {
  target: network1,

  bridges: {
    context: tonalCenter,
  },
}
```

Returns matching items.

---

## `@traverse(network)`

Traverses cross-graph topology.

Example:

```tat
path1 := @traverse(network) {
  target: network1,

  from: graph1,
  to: graph2,

  through: bridge1to2,

  depth: 3,
  limit: 10,

  rules: {
    backtracking: false,
    repeatGraphs: false,
    repeatBridges: false,
  },

  return: all,
}
```

Analytic directives remain consistent:

```txt
@query(domain)
@match(domain)
@traverse(domain)
```

---

# Projection

## `@project(network)`

Projects network topology.

Example:

```tat
projectNetwork := @project(network) {
  format: topology,
}
```

Applied as:

```tat
networkView := network1 <> projectNetwork(network1)
```

---

## `format: topology`

Projection executor must support a dedicated topology branch.

Landing zone:

```txt
runtime/projections/networkTopology.ts
```

Projection evaluation gathers:

```txt
network.anchor
network.graphs
network.bridges
network.contexts
network.hooks
network.state
network.meta
```

Reserved for future:

```txt
network.bindings
```

---

# Semantic Derivation

## `@derive(domain)`

Derives semantic meaning from semantic structure.

`@compute` is retired as a directive.

Computation helpers now live inside `@derive(...).formula`.

Example:

```tat
networkStatus := @derive(network) {
  target: network1,
  from: [state, topology],

  formula:
    bridge1to2 == "active"
      ? "connected"
      : "fragmented",
}
```

Supports:

```txt
arithmetic
comparison
boolean logic
membership
ternary
string concatenation
math helpers
```

Math helpers:

```txt
min()
max()
abs()
round()
floor()
ceil()
clamp()
sum()
avg()
```

---

# Actions

## `@action(domain)`

Defines reusable semantic behavior.

Only:

```txt
target
```

is required.

All other properties are developer-defined semantic bindings.

---

## Action Pipeline Context

Action execution becomes domain-aware.

```ts
type ActionPipelineContext = {
  graph?: Graph;

  network?: TATNetwork;
};
```

Meaning:

```txt
@action(graph)
  populates graph context

@action(network)
  populates network context
```

---

## Example

```tat
expandNetwork := @action(network) {
  target: network1,

  bridge: bridge2to3,

  ?> @query(network) {
    target: network1,
    graphs: [graph2],
  }

  -> @graft(network) {
    bridges: [bridge],
  }
}
```

---

# Reactive Listeners

## `@when(domain)`

Defines reactive semantic behavior.

Example:

```tat
bridgeListener := @when(network) {
  target: network1,

  condition: @query(state) {
    target: network1,
    key: bridge1to2,
    value: active,
  },

  action: activateBridgeAction,

  fallback: fallbackAction,

  projection: projectNetwork(network1),
}
```

When `target` is a network:

```txt
@query(state)
```

references network-level state.

---

## ReactiveTriggerRegistration

Reactive listeners become domain-aware.

```ts
type ReactiveTriggerRegistration = {
  domain: "graph" | "network";

  target: string;

  query: GraphControlExprNode;
};
```

---

## Reactive Trigger Behavior

v3.1 listeners trigger from:

```txt
@update(state)
@update(meta)
```

when targeting a network.

Topology mutation triggers may be added later.

---

# Repetition

## `@repeat(domain)`

Controlled semantic iteration.

Example:

```tat
activateBridges := @repeat(network) {
  target: network1,

  maxIterations: 100,

  while: @query(network) {
    target: network1,
    bridges: {
      context: progressionContext,
    },
  },

  over: @match(network) {
    target: network1,
    bridges: {
      context: progressionContext,
    },
  },

  action: activateBridgeAction,
}
```

---

# Injection

## `@inject`

Irregular interop directive.

Example:

```tat
network1 := network1
  <- @inject(networkHook, "network.py")
```

Injected material:

```txt
enters at pipeline position
inherits surrounding semantic scope
must validate as legal TAT
```

---

## Network Injection Scope

Network-level injected fragments:

```txt
may reference symbols already in scope
must validate against the receiving network context
```

Invalid bridge/hook/context/graph references fail validation.

Host languages do not mutate TAT directly.

They return TAT-compatible fragments.

---

# Interrogative Projections

These remain projection-flow directives:

```tat
<> @who()
<> @what()
<> @why()
<> @how()
```

They explain runtime behavior and become network-aware through network history entries.

---

# Flow Operators

```txt
->   mutation/execution flow
<>   projection flow
<-   injection flow
?>   conditional gate
:>   fallback flow
```

Distinction:

```txt
?> / :>
  execution flow

? :
  expression value selection
```

---

# Reference Semantics

Networks store references, not copies.

Meaning:

```txt
update at the source
project through references
```

Updating a graph/node/state/meta automatically affects networks projecting those structures.

---

# v3 → v3.1 Migration

## `@compute`

`@compute` is retired as a standalone directive.

Its helper functions now exist inside:

```txt
@derive(...).formula
```

Example:

Old:

```tat
value := @compute(max) { ... }
```

New:

```tat
value := @derive(domain) {
  formula: max(...)
}
```

---

# Runtime Philosophy

```txt
define semantic values
↓
seed graph/network
↓
query/match/traverse
↓
graft/prune/update
↓
project
```

TAT v3.1 formalizes this semantic lifecycle.
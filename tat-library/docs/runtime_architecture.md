# TAT Runtime Architecture

TAT runtime is organized around semantic responsibility.

The runtime does not treat execution as one giant process. It separates source orchestration, binding evaluation, flow execution, directive behavior, entity creation, and value evaluation into focused modules.

## Runtime Flow

```txt
source
  ↓
parse program
  ↓
validate program
  ↓
create runtime context
  ↓
evaluate top-level bindings
  ↓
execute flows/directives
  ↓
collect graphs, projections, events, listeners, exports
````

## Core Folders

```txt
runtime/
  engine/
  bindings/
  flow/
  flow/steps/
  directives/
  entities/
  evaluation/
  projections/
  injection/
```

## engine/

Owns high-level runtime orchestration.

```txt
engine/runSource.ts
  parses source and starts execution

engine/runProgram.ts
  validates and executes a parsed program

engine/createResult.ts
  creates the runtime result object
```

The engine should not own directive behavior.

## bindings/

Owns top-level semantic binding evaluation.

```txt
bindings/classifyBinding.ts
  identifies seed/read/flow/action/project bindings

bindings/evaluateTopLevelBinding.ts
  dispatches top-level binding evaluation

bindings/evaluateReadBinding.ts
  evaluates read-only top-level directives
```

Bindings answer:

```txt
What kind of semantic value is being bound?
```

## flow/

Owns pipeline execution.

```txt
flow/evaluateFlowBinding.ts
flow/resolveFlowSource.ts
flow/executeFlowSteps.ts
flow/executeFlowStep.ts
```

Flow answers:

```txt
How does a semantic structure change step by step?
```

## flow/steps/

Owns specific flow step behavior.

```txt
flow/steps/actionStep.ts
flow/steps/injectionStep.ts
flow/steps/repeatStep.ts
flow/steps/projectionStep.ts
flow/steps/stepHelpers.ts
```

Flow step handlers execute:

```txt
actions
injections
repeats
projections
```

## directives/

Owns directive semantics.

```txt
directives/seed.ts
directives/graft.ts
directives/prune.ts
directives/update.ts
directives/query.ts
directives/match.ts
directives/traverse.ts
directives/when.ts
```

Directive files should own real behavior, not wrap runtime engine logic.

## entities/

Owns runtime entity creation.

```txt
entities/graph/createGraph.ts
```

Future v3.1 network support should add:

```txt
entities/network/createNetwork.ts
```

## evaluation/

Owns value and expression evaluation.

```txt
evaluation/evaluateValue.ts
evaluation/readHelpers.ts
```

This layer evaluates:

```txt
identifiers
objects
paths
expressions
function calls
binary operations
read directive values
```

## Runtime Design Rules

### 1. No God files

No runtime file should own orchestration, directive execution, mutation logic, projection logic, and value evaluation all at once.

### 2. No wrapper theater

A module should not exist only to call another module.

Bad:

```ts
export function executeGraft(...) {
  return runtimeEngine.executeGraft(...);
}
```

Good:

```ts
export function executeGraft(...) {
  // actual graft behavior lives here
}
```

### 3. Direct semantic imports

Internal runtime files should import from the specific file they need.

Prefer:

```ts
import { executeGraft } from "../directives/graft.js";
```

Avoid internal barrel imports when possible.

### 4. Public barrels are allowed

Top-level package entry files may re-export public APIs.

Internal files should avoid relying on barrels.

### 5. Runtime context stores shared semantic truth

Graphs, projections, events, actions, listeners, imports, exports, and future networks should live in runtime context/result structures.

### 6. Mutations happen at the source

A structure should be updated once at its source. Other structures should observe it by reference, not duplicate it.

### 7. Directives own behavior

Each directive file owns the behavior for that directive domain.

Examples:

```txt
graft.ts    owns @graft behavior
prune.ts    owns @prune behavior
update.ts   owns @update behavior
query.ts    owns @query behavior
match.ts    owns @match behavior
traverse.ts owns @traverse behavior
when.ts     owns @when behavior
```

## v3.1 Network Landing Zones

Network support should land in these places:

```txt
@seed(network)
  runtime/directives/seed.ts
  runtime/entities/network/createNetwork.ts

@graft(network)
  runtime/directives/graft.ts

@prune(network)
  runtime/directives/prune.ts

@update(network)
  runtime/directives/update.ts

@query(network)
  runtime/directives/query.ts

@match(network)
  runtime/directives/match.ts

@traverse(network)
  runtime/directives/traverse.ts

@project(network)
  runtime/flow/steps/projectionStep.ts
  runtime/projections/
```

## Current Philosophy

TAT runtime should mirror TAT language semantics:

```txt
semantic values
  ↓
seed graph/network
  ↓
query/match/traverse
  ↓
graft/prune/update
  ↓
project
```

The codebase should make that lifecycle visible.

import type { V3RuntimeEvent } from "../context.js";

export function buildHowOutput(events: V3RuntimeEvent[]): Record<string, unknown> {
  return {
    kind: "how",
    steps: events.map(summarizeHowEvent),
  };
}

export function summarizeHowEvent(event: V3RuntimeEvent): Record<string, unknown> {
  if (event.type === "gate") return { type: "gate", operator: event.operator, passed: event.passed };
  if (event.type === "action") return { type: "action", name: event.name, args: event.args ?? [] };
  if (event.type === "mutation") {
    return {
      type: "mutation",
      directive: event.directive,
      domain: event.domain,
      paths: (event.changes ?? []).map((change) => change.path),
    };
  }
  if (event.type === "projection") return { type: "projection", directive: event.projection };
  if (event.type === "repeat") {
    return {
      type: "repeat",
      iterations: event.iterations,
      stoppedBy: event.stoppedBy,
    };
  }
  if (event.type === "trigger") {
    return {
      type: "trigger",
      event: event.event,
      activated: event.activated,
    };
  }
  if (event.type === "injection") {
    return {
      type: "injection",
      hook: event.hook,
      file: event.file,
      generatedTat: event.generatedTat,
      diagnostics: event.diagnostics,
      executedSteps: (event.executedSteps ?? []).map(summarizeHowEvent),
    };
  }
  return { type: event.type };
}

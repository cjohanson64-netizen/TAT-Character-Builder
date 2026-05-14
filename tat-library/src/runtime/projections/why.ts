import type { V3RuntimeEvent } from "../context.js";

export function buildWhyOutput(events: V3RuntimeEvent[]): Record<string, unknown> {
  return {
    kind: "why",
    causes: events
      .filter((event) => event.type === "query")
      .map((event) => ({
        type: "query",
        domain: event.detail?.domain,
        result: event.detail?.result,
        condition: event.detail?.condition,
      })),
    gates: events
      .filter((event) => event.type === "gate")
      .map((event) => ({ operator: event.operator, passed: event.passed })),
    triggers: events
      .filter((event) => event.type === "trigger")
      .map((event) => ({
        event: event.event,
        activated: event.activated,
        condition: event.detail?.condition,
      })),
  };
}

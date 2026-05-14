import type { V3RuntimeEvent } from "../context.js";

export function buildWhatOutput(events: V3RuntimeEvent[]): Record<string, unknown> {
  return {
    kind: "what",
    actions: events
      .filter((event) => event.type === "action")
      .map((event) => ({ name: event.name, args: event.args ?? [] })),
    changes: events
      .filter((event) => event.type === "mutation")
      .flatMap((event) =>
        (event.changes ?? []).map((change) => ({
          domain: event.domain,
          path: change.path,
          from: change.from,
          to: change.to,
          operation: change.operation,
        })),
      ),
  };
}

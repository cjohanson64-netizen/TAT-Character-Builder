import type { V3RuntimeEvent } from "../context.js";

export function buildWhoOutput(events: V3RuntimeEvent[]): Record<string, unknown> {
  const nodes: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const event of events) {
    if (event.type === "action") {
      const [actor, target] = event.args ?? [];
      addRole(nodes, seen, "actor", actor);
      addRole(nodes, seen, "target", target);
    }

    if (event.type === "mutation") {
      for (const change of event.changes ?? []) {
        addRole(nodes, seen, "affected", change.path.split(".")[0]);
      }
    }
  }

  return { kind: "who", nodes };
}

function addRole(
  nodes: Array<Record<string, unknown>>,
  seen: Set<string>,
  role: "actor" | "target" | "affected",
  value: unknown,
): void {
  if (typeof value !== "string" || !value) return;
  const key = `${role}:${value}`;
  if (seen.has(key)) return;
  seen.add(key);
  nodes.push({ role, id: value });
}

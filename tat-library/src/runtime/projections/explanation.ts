import type { V3RuntimeEvent } from "../context.js";
import { buildHowOutput } from "./how.js";
import { buildWhatOutput } from "./what.js";
import { buildWhoOutput } from "./who.js";
import { buildWhyOutput } from "./why.js";

export function buildExplanationOutput(
  name: "who" | "what" | "why" | "how",
  events: V3RuntimeEvent[],
): Record<string, unknown> {
  if (name === "who") return buildWhoOutput(events);
  if (name === "what") return buildWhatOutput(events);
  if (name === "why") return buildWhyOutput(events);
  return buildHowOutput(events);
}

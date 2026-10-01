// Owns the commit classes tally that the report, the comparison and `inspect` share.
import { Schema } from "effect";

const Count = Schema.Natural;

/** Commits per class; the four classes partition the commits they count. */
export const AutomationTotals = Schema.Struct({
  /** Commits by a human with no agent detected. */
  human: Count,
  /** Commits by a human that carry an agent's trailer, marker or committer; each counts once. */
  agentAssisted: Count,
  /** Commits authored by an AI agent. */
  agent: Count,
  /** Commits authored by an automation account that is not an agent. */
  bot: Count,
});

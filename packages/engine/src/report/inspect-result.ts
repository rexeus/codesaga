// Owns the versioned `inspect` result that agents and the CLI read.
// It reuses the report's shapes, so the two commands describe people and automation alike.
// Additive fields keep schemaVersion 1; renaming or removing a field bumps it.
import { Schema } from "effect";

import { ActivityWindow, AutomationTotals, Expert } from "./report.js";

/** The answer for one `inspect` argument, aggregated over the files it matches. */
const InspectEntry = Schema.Struct({
  /** The argument as given. */
  pattern: Schema.String,
  /** Universe files the argument matches. */
  files: Schema.Natural,
  /** People who must leave before more than half of the matched files have no expert. */
  truckFactor: Schema.Natural,
  /** One person is the sole expert on at least `thresholds.islandShare` of the matched files. */
  island: Schema.Boolean,
  /** More than `thresholds.orphanedShare` of the matched files have no active expert. */
  orphaned: Schema.Boolean,
  /** The five people expert on the most matched files, most files first. */
  experts: Schema.Array(Expert).check(Schema.isMaxLength(5)),
  /** Commits to the matched files in the window. */
  commits: Schema.Natural,
  /** ISO timestamp of the newest commit to the matched files in the window; null without one. */
  lastCommitAt: Schema.NullOr(Schema.String),
  /** The window's commits to the matched files by class. */
  automation: AutomationTotals,
  /** Plain-language explanations of the flags and of notable automation. */
  reasons: Schema.Array(Schema.String),
});

/**
 * The full result of `inspect`: one entry per matching argument and the
 * arguments that matched no universe file. Expertise covers the whole
 * history; `commits`, `lastCommitAt` and `automation` cover `window`.
 */
export const InspectResult = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  window: ActivityWindow,
  matches: Schema.Array(InspectEntry),
  unmatched: Schema.Array(Schema.String),
});
export type InspectResult = typeof InspectResult.Type;

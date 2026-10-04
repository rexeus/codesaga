// Owns the shape of `deepDives.typescript.trends`: how the TypeScript and JavaScript code changed over the whole history.
// The digests of every historical file version, replayed along the first-parent chain; counts at month ends, never a grade.
import { Schema } from "effect";

const Count = Schema.Natural;

/**
 * A change of a compiler flag in one `tsconfig`, as that config effectively
 * sets it: its own options over the configs it extends, so a flip in a base
 * config shows on the configs that extend it. A flag that a config which
 * could not be read may have set is not reported.
 */
const FlagEvent = Schema.Struct({
  /** The day of the commit, `YYYY-MM-DD` in UTC. */
  date: Schema.String,
  /** Repository-relative path of the config, under the name it had at that commit. */
  path: Schema.String,
  flag: Schema.Literals(["strict", "noUncheckedIndexedAccess"]),
  /** The value before the commit; null when the commit created the config. */
  from: Schema.NullOr(Schema.Boolean),
  to: Schema.Boolean,
});

/** What the commits of one class did to the escape hatches of the window, per commit and as a net sum over its TypeScript and JavaScript files. */
const ClassEscapes = Schema.Struct({
  /** Commits of the class that changed a TypeScript or JavaScript file. */
  commits: Count,
  /** The escape sites that commits of the class added: the sum of each commit's positive net change. */
  added: Count,
  /** The escape sites that commits of the class removed: the sum of each commit's negative net change. */
  removed: Count,
});

/**
 * The code over time, from the first commit's month to the current one.
 *
 * `series` holds one array per name, aligned with `months`: `production.*`
 * and `tests.*` for `files`, `lines` (non-blank lines, as `typeSafety` counts them), `any` (explicit `any` keywords), `escapes`
 * (escape sites, as `typeSafety` counts them), `suppressions` (`@ts-`
 * directives and lint disables), `functions`, `complexFunctions` (cognitive
 * complexity of 15 or more), `esmFiles` and `commonjsFiles` (tooling configs
 * such as `jest.config.js` are left out of these two); `tests.testCases`
 * and `tests.focusedTests` besides. Each point is the total over the files
 * that exist at the end of that month, replayed along the first-parent chain of
 * the head: the state after the last commit dated in that month or before it,
 * so a commit dated earlier than the ones before it counts from its own month
 * on. The last point is the head's committed tree, not uncommitted edits.
 * Production and tests are told apart by the path a file had at that time.
 */
export const Trends = Schema.Struct({
  /** `YYYY-MM`, oldest first. */
  months: Schema.Array(Schema.String),
  series: Schema.Record(Schema.String, Schema.Array(Count)),
  /** The 20 newest flag changes, oldest first; older ones are cut. */
  events: Schema.Array(FlagEvent),
  /**
   * The escape hatches that commits added and removed in the activity window,
   * by class. The agent share is a lower bound, because a commit without a
   * marker counts as human; it is never shown per person.
   */
  escapesByAutomation: Schema.Struct({
    human: ClassEscapes,
    "agent-assisted": ClassEscapes,
    agent: ClassEscapes,
    bot: ClassEscapes,
  }),
});
export type Trends = typeof Trends.Type;

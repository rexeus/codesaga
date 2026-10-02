// Owns the highlight schema of the report: the notable facts about a repository's history and team.
// Events and team facts only; no highlight ranks one person against another.
// A new kind is an additive change; renaming or removing one bumps the schema version.
import { Schema } from "effect";

/**
 * One notable fact. `title` and `detail` are ready to show; the optional
 * fields carry the facts behind them for consumers that draw their own. Which
 * of them are set, and what `value` counts, depends on `kind`:
 *
 * - `anniversary`: `value` is the age in `unit`, years or days for the 100, 500 and 1000 day milestones; `date` is the anniversary, up to seven days from now.
 * - `streak`: `value` is the days of the longest run of days with a commit (author's local days), `date` its first day.
 * - `night-owls`: `value` is the share (0 to 1) of human commits at 22:00 to 05:00 local time.
 * - `weekend`: `value` is the share (0 to 1) of human commits on a Saturday or Sunday local time.
 * - `newcomers`: `value` is the people whose first commit lies in the last 90 days, `people` the first five.
 * - `quiet-area`: `value` is the months without a change, `path` the area, `date` its last change.
 * - `rename-record`: `value` is the renames of the most renamed file, `path` its path today.
 * - `biggest-cleanup`: `value` is the net deleted code lines of the commit, `date` its day.
 * - `busiest-day`: `value` is the commits of the day, `date` the author's local day.
 * - `truck-factor-alert`: `value` is the truck factor (1), `people` the person who must leave.
 * - `orphaned-knowledge`: `value` is the files without an active expert, `path` the largest orphaned area.
 */
export const Highlight = Schema.Struct({
  kind: Schema.Literals([
    "anniversary",
    "streak",
    "night-owls",
    "weekend",
    "newcomers",
    "quiet-area",
    "rename-record",
    "biggest-cleanup",
    "busiest-day",
    "truck-factor-alert",
    "orphaned-knowledge",
  ]),
  /** The headline, such as "Longest streak". */
  title: Schema.String,
  /** One sentence that states the fact. */
  detail: Schema.String,
  /** The number the fact is about; its unit depends on `kind`. */
  value: Schema.optionalKey(Schema.Finite),
  /** What `value` counts: set for `anniversary` only, absent for every other kind. */
  unit: Schema.optionalKey(Schema.Literals(["years", "days"])),
  /** `YYYY-MM-DD`; UTC, except for `streak` and `busiest-day`, which read the author's local calendar days. */
  date: Schema.optionalKey(Schema.String),
  /** Repository-relative path of the area or file the fact is about. */
  path: Schema.optionalKey(Schema.String),
  /** The people the fact names, by identity. */
  people: Schema.optionalKey(
    Schema.Array(Schema.Struct({ name: Schema.String, email: Schema.String })),
  ),
});
export type Highlight = typeof Highlight.Type;

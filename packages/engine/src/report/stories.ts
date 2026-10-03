// Owns the story schema of the report: the notable facts about a repository's history and team.
// Events and team facts only; no story ranks one person against another.
// A new kind is an additive change; renaming or removing one bumps the schema version.
import { Schema } from "effect";

/**
 * One notable fact. `title` and `detail` are ready to show; the optional
 * fields carry the facts behind them for consumers that draw their own. Which
 * of them are set, and what `value` counts, depends on `kind`:
 *
 * - `anniversary`: `value` is the age in `unit`, years or days for the 100, 500 and 1000 day milestones; `date` is the anniversary, up to seven days from now.
 * - `streak`: `value` is the days of the longest run of days with a human or agent-assisted commit (author's local days), `date` its first day.
 * - `night-owls`: `value` is the share (0 to 1) of human commits at 22:00 to 05:00 local time.
 * - `weekend`: `value` is the share (0 to 1) of human commits on a Saturday or Sunday local time.
 * - `newcomers`: `value` is the people whose first commit lies in the last 90 days, `people` the first five.
 * - `quiet-territory`: `value` is the months without a change, `path` the territory, `date` its last change.
 * - `rename-record`: `value` is the renames of the most renamed file, `path` its path today.
 * - `biggest-cleanup`: `value` is the net deleted code lines of the commit, `date` its day.
 * - `busiest-day`: `value` is the commits of the day, `date` the author's local day.
 * - `truck-factor-alert`: `value` is the truck factor (1), `people` the person who must leave.
 * - `orphaned-knowledge`: `value` is the files without an active expert, `path` the largest orphaned territory.
 * - `focused-test`: `value` is the focused test cases (`.only`, `fit`, `fdescribe`) in the test files, `path` the first file that holds one.
 * - `complex-core`: `value` is the cognitive complexity of the hardest production function, `path` its file.
 * - `core-territory`: `value` is the territories that import the territory's production files, `path` the territory.
 * - `strict-since`: `value` is the months `strict` has been on, `date` the day of the commit that turned it on or created the config with it on, `path` the config of the extends chain that did, base first, of the `tsconfig` that governs the most files. The `title` and `detail` tell a switch from off to on ("Strict since"), a config created strict ("Strict since", with the creation day) and a config that was strict in the first commit the history read ("Strict from the start"), which says nothing of how it came to be. Needs the history.
 * - `type-trend`: `value` is the relative change of the production escape hatches per 1,000 lines over the last 12 months (-0.6 is a fall of 60%). Needs the history.
 * - `module-era`: `value` is the share (0 to 1) of the production module files that use CommonJS today; 0 says ESM-only, and then `date` is the first day of the month since which no production file used CommonJS. Needs the history.
 */
export const Story = Schema.Struct({
  kind: Schema.Literals([
    "anniversary",
    "streak",
    "night-owls",
    "weekend",
    "newcomers",
    "quiet-territory",
    "rename-record",
    "biggest-cleanup",
    "busiest-day",
    "truck-factor-alert",
    "orphaned-knowledge",
    "focused-test",
    "complex-core",
    "core-territory",
    "strict-since",
    "type-trend",
    "module-era",
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
  /** Repository-relative path of the territory or file the fact is about. */
  path: Schema.optionalKey(Schema.String),
  /** The people the fact names, by identity. */
  people: Schema.optionalKey(
    Schema.Array(Schema.Struct({ name: Schema.String, email: Schema.String })),
  ),
});
export type Story = typeof Story.Type;

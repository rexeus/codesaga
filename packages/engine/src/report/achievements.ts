// Owns the achievement schema of the report: the milestones the repository as a whole has reached.
// A milestone states a threshold that was passed and never compares people.
// A new kind is an additive change; renaming or removing one bumps the schema version.
import { Schema } from "effect";

const Count = Schema.Natural;

/**
 * One achievement; every kind is listed, reached or not, in the order of
 * `kind` below. `title` and `detail` are ready to show. Achievements read the
 * scope's full history, whatever `--since` narrowed the window to, and count
 * the contributors and commits that the other sections count.
 *
 * `holds` tells how a reached achievement is kept:
 *
 * - `milestone`: once reached, always reached. `reachedAt` is the day it was
 *   first passed, computed from the history, `YYYY-MM-DD` in UTC; `unbroken`
 *   names the author's local day instead.
 * - `state`: true of the repository today and lost when it stops being true.
 *   `reachedAt` is always null.
 *
 * A shallow clone misses the oldest history. Its milestones are still reached
 * when the commits it has show them, and their `detail` says the figures are
 * at least that much, but their `reachedAt` is null, since an older commit may
 * have passed the threshold first. Its states that read the full history,
 * `bus-proof` and `fresh-blood`, are withheld: not reached, `progress` null.
 *
 * - `first-commits`: tiers of 1,000 and 10,000 commits; `title` names the highest tier reached, or the first.
 * - `marathon`: 1,000 days between the first and the last commit; `reachedAt` is 1,000 days after the first commit.
 * - `community`: tiers of 10, 50 and 100 contributors over the full history; `reachedAt` is the day the highest tier's contributor made a first commit. No contributor is named.
 * - `bus-proof`: a truck factor of at least 5.
 * - `polyglot`: at least 5 languages with each at least 1% of the code lines, "Other" not being one. `reachedAt` is estimated from the net lines each commit added per language, and falls back to the last commit when only the files at HEAD show it.
 * - `test-culture`: at least 30% of the files are tests.
 * - `unbroken`: a human or agent-assisted commit on each of 30 consecutive days; `reachedAt` is the 30th day of the first such run.
 * - `spring-cleaning`: one commit that removed at least 1,000 more code lines than it added; `reachedAt` is the day of the first.
 * - `fresh-blood`: at least 5 people made their first commit in the last 90 days.
 */
export const Achievement = Schema.Struct({
  kind: Schema.Literals([
    "first-commits",
    "marathon",
    "community",
    "bus-proof",
    "polyglot",
    "test-culture",
    "unbroken",
    "spring-cleaning",
    "fresh-blood",
  ]),
  title: Schema.String,
  /** The highest tier reached, counted from 1; set only for a tiered kind that has reached one. */
  tier: Schema.optionalKey(Count),
  /** The thresholds of the tiers, ascending; set only for a tiered kind. */
  tiers: Schema.optionalKey(Schema.Array(Count)),
  reached: Schema.Boolean,
  reachedAt: Schema.NullOr(Schema.String),
  holds: Schema.Literals(["milestone", "state"]),
  /** One sentence that states the fact; in a shallow clone the figures are at least that much. */
  detail: Schema.String,
  /**
   * How far the repository is from the next threshold: the next tier of a
   * tiered kind or the threshold of a locked one. Null when nothing is left to
   * reach and when the figure is withheld.
   */
  progress: Schema.NullOr(
    Schema.Struct({
      value: Count,
      target: Count,
      /** What `value` and `target` count, such as "commits" or "days in a row". */
      unit: Schema.String,
    }),
  ),
});
export type Achievement = typeof Achievement.Type;

// Owns the report's `achievements`: the nine milestones of the repository, each reached or not.
// Milestones read the history once, states read today's figures; the list is complete and fixed in order, so a consumer draws a locked one too.
// Cost: the passes of `historyFacts` over the commits and their changes.

import type { DateTime } from "effect";

import type { ClassifiedCommit } from "../automation/classify.js";
import type { Achievement } from "../report/achievements.js";
import type { CodeStats } from "../report/code-stats.js";
import { polyglot, springCleaning, unbroken } from "./code-milestones.js";
import { community, firstCommits, marathon } from "./count-milestones.js";
import { historyFacts } from "./history-facts.js";
import { busProof, freshBlood, testCulture } from "./state-achievements.js";

/** Everything the achievements read; all of it is already computed by the other sections. */
export type AchievementFacts = {
  /** The scope's classified commits over the full history, newest first, whatever the window. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  /** The `Clock` time that "the last 90 days" is measured back from. */
  readonly now: DateTime.Utc;
  /** A shallow clone misses the oldest history: see the `Achievement` schema. */
  readonly shallow: boolean;
  /** Whether a changed path counts toward code lines. */
  readonly isCodePath: (path: string) => boolean;
  /** The universe's files, tests and languages at HEAD. */
  readonly stats: Pick<CodeStats, "files" | "tests" | "languages">;
  /** The truck factor of the universe. */
  readonly truckFactor: number;
};

/**
 * The nine achievements in the fixed order of `Achievement.kind`, reached or
 * not. Counts people and commits and names nobody. Pure: the same facts give
 * the same list. In a shallow clone milestones have no `reachedAt` and states
 * that need the full history are withheld.
 */
export const achievements = ({
  commits,
  now,
  shallow,
  isCodePath,
  stats,
  truckFactor,
}: AchievementFacts): ReadonlyArray<Achievement> => {
  const history = historyFacts(commits, isCodePath);
  const languages = stats.languages.map(({ name, lines }) => ({ name, lines }));
  return [
    firstCommits(history, shallow),
    marathon(history, shallow),
    community(history, shallow),
    busProof(truckFactor, shallow),
    polyglot(history, languages, shallow),
    testCulture(stats),
    unbroken(history, shallow),
    springCleaning(history, shallow),
    freshBlood(history.contributorStarts, now, shallow),
  ];
};

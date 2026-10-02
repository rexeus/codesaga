// Owns the code stats of a universe, ready to answer for any set of its files.
// The caller decides which sets to ask about, the repository itself and territories alike;
// nothing here knows how territories are cut.

import type { HistoryCommit } from "../history/history.js";
import type { CodeStats } from "../report/code-stats.js";
import type { InventoryFile } from "../universe/inventory.js";
import { codeStats } from "./code-stats.js";
import { commitHabits } from "./commit-habits.js";
import { revisionsOf } from "./revisions.js";

/** The stats of a universe: of all of it, and of any subset of its files. */
export type UniverseStats = {
  /** The stats of all universe files, with the commit habits of the activity window. */
  readonly repository: CodeStats;
  /** The stats of the universe files at `paths`, without commit habits; a path that is not a universe file counts for nothing. */
  readonly forPaths: (paths: ReadonlyArray<string>) => CodeStats;
};

type UniverseStatsInput = {
  readonly universe: ReadonlyArray<InventoryFile>;
  /** The scope's whole history, which the revisions of the files come from. */
  readonly history: ReadonlyArray<Pick<HistoryCommit, "changes">>;
  /** The non-merge commits of the activity window, which the commit habits come from. */
  readonly window: Parameters<typeof commitHabits>[0];
  /** Whether a path counts as code, for files that no longer exist too. */
  readonly isCodePath: (path: string) => boolean;
};

/** Measures the universe against its history. */
export const universeStats = ({
  universe,
  history,
  window,
  isCodePath,
}: UniverseStatsInput): UniverseStats => {
  const revisions = revisionsOf(history);
  const files = new Map(universe.map((file) => [file.path, file]));
  const stats = codeStats(universe, revisions);
  return {
    repository: {
      ...stats,
      style: { ...stats.style, ...commitHabits(window, isCodePath) },
    },
    forPaths: (paths) =>
      codeStats(
        paths.flatMap((path) => files.get(path) ?? []),
        revisions,
      ),
  };
};

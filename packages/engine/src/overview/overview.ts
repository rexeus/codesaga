// Owns the overview section: commits, contributor counts, and the size and languages of the universe.
// It reads the universe as inventory already measured it and never touches files.
// Languages come from the allow-list's extension map; one pass over the universe.

import { Order } from "effect";
import type { DateTime } from "effect";

import { isContributorCommit } from "../automation/classify.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { groupBy } from "../collections/group-by.js";
import {
  ACTIVE_CONTRIBUTOR_DAYS,
  isActiveWithin,
} from "../contributors/activeness.js";
import { countContributors } from "../contributors/count-contributors.js";
import type { Report } from "../report/report.js";
import type { InventoryFile } from "../universe/inventory.js";
import { languageOf } from "../universe/languages.js";

type OverviewInput = {
  /** The window's commits of every class. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  /** The scope's commits of every class over the full history, whatever the window. */
  readonly history: ReadonlyArray<ClassifiedCommit>;
  readonly universe: ReadonlyArray<InventoryFile>;
  /** The `Clock` time that the 30, 90 and 365 day counts are measured back from. */
  readonly now: DateTime.Utc;
};

/** The language of files whose extension is not on the allow-list; only `--include` admits them. */
const OTHER_LANGUAGE = "Other";

type Language = Report["overview"]["languages"][number];

const byLinesThenName = Order.combine(
  Order.flip(
    Order.mapInput(Order.Number, (language: Language) => language.loc),
  ),
  Order.mapInput(Order.String, (language: Language) => language.name),
);

const sumOfLoc = (files: ReadonlyArray<InventoryFile>): number =>
  files.reduce((sum, file) => sum + file.loc, 0);

const languagesOf = (
  universe: ReadonlyArray<InventoryFile>,
): Report["overview"]["languages"] =>
  [...groupBy(universe, (file) => languageOf(file.path) ?? OTHER_LANGUAGE)]
    .map(([name, files]) => ({
      name,
      files: files.length,
      loc: sumOfLoc(files),
    }))
    .toSorted(byLinesThenName);

/** The last commit time of each contributor, in seconds since the epoch. */
const lastCommitTimes = (
  commits: ReadonlyArray<ClassifiedCommit>,
): ReadonlyArray<number> =>
  [
    ...groupBy(
      commits.filter((commit) => isContributorCommit(commit)),
      (commit) => commit.author.email,
    ).values(),
  ].map((own) => own.reduce((last, { time }) => Math.max(last, time), 0));

/**
 * The `overview` section: the window's commit count, its contributors and
 * those active in the last 30, 90 and 365 days, the contributors over the full
 * history, and the universe's files and non-blank lines, per language with the
 * most lines first.
 */
export const overview = ({
  commits,
  history,
  universe,
  now,
}: OverviewInput): Report["overview"] => {
  const lastTimes = lastCommitTimes(commits);
  const activeWithin = (days: number) =>
    lastTimes.filter((time) => isActiveWithin(time, now, days)).length;
  return {
    commits: commits.length,
    contributors: {
      total: lastTimes.length,
      active30: activeWithin(30),
      active90: activeWithin(ACTIVE_CONTRIBUTOR_DAYS),
      active365: activeWithin(365),
      allTime: countContributors(history),
    },
    files: universe.length,
    loc: sumOfLoc(universe),
    languages: languagesOf(universe),
  };
};

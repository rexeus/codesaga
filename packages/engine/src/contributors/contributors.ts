// Owns the contributors section: one entry per human or agent-assisted identity.
// Bots and agents are not contributors; automation reports them.
// Returns every contributor; truncating for output belongs to the caller.

import { Order } from "effect";
import type { DateTime } from "effect";

import { localDayOf } from "../activity/buckets.js";
import { isoOfEpochSeconds } from "../analyze/analysis-window.js";
import { isContributorCommit } from "../automation/classify.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { contributorBadges } from "../badges/contributor-badges.js";
import type { ContributorBadgeFacts } from "../badges/contributor-badges.js";
import { groupBy } from "../collections/group-by.js";
import { countCodeLines } from "../history/history.js";
import { contributionsByFile } from "../knowledge/contributions.js";
import type { Report } from "../report/report.js";
import { ACTIVE_DAYS, isActiveWithin } from "./activeness.js";
import { topAreas } from "./areas.js";
import { contributorStatus } from "./status.js";
import { weeklyCommits } from "./weekly.js";

type ContributorsInput = {
  /** The window's commits of every class. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  /** The scope's commits of every class over the full history; a contributor is new by their first commit there, not in the window. */
  readonly history: ReadonlyArray<ClassifiedCommit>;
  /** Repository-relative scope; "." for the whole repository. The main folders are cut relative to it. */
  readonly scope: string;
  /** The `Clock` time that "active" is measured back from. */
  readonly now: DateTime.Utc;
  /** Whether a changed path counts toward added and deleted lines. */
  readonly isCodePath: (path: string) => boolean;
  /** The universe files of the scope; the files each person created decide `founder`. */
  readonly universePaths: ReadonlyArray<string>;
  /** A shallow clone lacks the history before its boundary, so nobody can be told to be new. */
  readonly shallow: boolean;
  /** The territories of the recommended detail; without them `all-rounder`, `specialist` and `keeper` are withheld. */
  readonly territories?: ContributorBadgeFacts["territories"];
};

type Contributor = Report["contributors"][number];

const byEmail = (
  commits: ReadonlyArray<ClassifiedCommit>,
): ReadonlyMap<string, ReadonlyArray<ClassifiedCommit>> =>
  groupBy(
    commits.filter((commit) => isContributorCommit(commit)),
    (commit) => commit.author.email,
  );

const byCommitsThenName = Order.combine(
  Order.flip(Order.mapInput(Order.Number, (c: Contributor) => c.commits)),
  Order.mapInput(Order.String, (c: Contributor) => c.name),
);

/** How many of the universe files each person created: the author of the file's oldest commit, when a person wrote it. */
const createdFilesByEmail = (
  history: ReadonlyArray<ClassifiedCommit>,
  universePaths: ReadonlyArray<string>,
): ReadonlyMap<string, number> => {
  const created = new Map<string, number>();
  for (const contributions of contributionsByFile(
    history,
    new Set(universePaths),
  ).values()) {
    const founder = contributions.find(({ firstAuthor }) => firstAuthor);
    if (founder !== undefined) {
      created.set(founder.email, (created.get(founder.email) ?? 0) + 1);
    }
  }
  return created;
};

type Context = Omit<ContributorsInput, "commits" | "history" | "shallow"> & {
  readonly created: ReadonlyMap<string, number>;
  /** How many people count as contributors over the full history. */
  readonly historyContributors: number;
  /** The time of the first commit of anyone who counts as a contributor; undefined in a shallow clone. */
  readonly repositoryStart: number | undefined;
};

const contributorOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
  ownHistory: ReadonlyArray<ClassifiedCommit>,
  {
    scope,
    now,
    isCodePath,
    universePaths,
    territories,
    created,
    historyContributors,
    repositoryStart,
  }: Context,
): Contributor => {
  const times = commits.map((commit) => commit.time);
  const lastTime = times.reduce((a, b) => Math.max(a, b));
  const email = commits[0]?.author.email ?? "";
  return {
    name: commits[0]?.author.name ?? "",
    email,
    commits: commits.length,
    agentAssistedCommits: commits.filter(
      (commit) => commit.class === "agent-assisted",
    ).length,
    activeDays: new Set(
      commits.map((commit) => localDayOf(commit.time, commit.offsetMinutes)),
    ).size,
    ...countCodeLines(commits, isCodePath),
    firstCommitAt: isoOfEpochSeconds(times.reduce((a, b) => Math.min(a, b))),
    lastCommitAt: isoOfEpochSeconds(lastTime),
    active: isActiveWithin(lastTime, now, ACTIVE_DAYS),
    areas: topAreas(commits, scope),
    weekly: weeklyCommits(times, now),
    status: contributorStatus(
      ownHistory.reduce((first, { time }) => Math.min(first, time), Infinity),
      lastTime,
      repositoryStart,
      now,
    ),
    badges: contributorBadges(email, {
      commits: ownHistory,
      now,
      repositoryStart,
      historyContributors,
      isCodePath,
      founded: {
        files: created.get(email) ?? 0,
        ofFiles: universePaths.length,
      },
      ...(territories === undefined ? {} : { territories }),
    }),
  };
};

/**
 * The `contributors` section, sorted by commits descending, then name. `activeDays`
 * counts distinct local dates; `active` means a commit in the 183 days before
 * `now`, `status` is judged over 90 days, and nobody is `new` in a shallow clone;
 * `areas` are the three directories with the most commits, cut at two
 * directories below the scope; `weekly`, `status` and `badges` serve the
 * contributor card.
 */
export const contributors = ({
  commits,
  history,
  shallow,
  ...input
}: ContributorsInput): Report["contributors"] => {
  const everyone = byEmail(history);
  const context = {
    ...input,
    created: createdFilesByEmail(history, input.universePaths),
    historyContributors: everyone.size,
    repositoryStart: shallow
      ? undefined
      : [...everyone.values()]
          .flat()
          .reduce((first, { time }) => Math.min(first, time), Infinity),
  };
  return [...byEmail(commits)]
    .map(([email, own]) =>
      contributorOf(own, everyone.get(email) ?? own, context),
    )
    .toSorted(byCommitsThenName);
};

// Owns the contributors section: one entry per human or agent-assisted identity.
// Bots and agents are not contributors; automation reports them.
// Returns every contributor; truncating for output belongs to the caller.

import { DateTime, Order } from "effect";

import { localDayOf } from "../activity/buckets.js";
import { isContributorCommit } from "../automation/classify.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { groupBy } from "../collections/group-by.js";
import { countCodeLines } from "../history/history.js";
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
  /** Repository-relative scope; "." for the whole repository. Areas are cut relative to it. */
  readonly scope: string;
  /** The `Clock` time that "active" is measured back from. */
  readonly now: DateTime.Utc;
  /** Whether a changed path counts toward added and deleted lines. */
  readonly isCodePath: (path: string) => boolean;
};

type Contributor = Report["contributors"][number];

const isoOf = (time: number): string =>
  DateTime.formatIso(DateTime.makeUnsafe(time * 1000));

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

const contributorOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
  firstEverTime: number,
  { scope, now, isCodePath }: Omit<ContributorsInput, "commits" | "history">,
): Contributor => {
  const times = commits.map((commit) => commit.time);
  const lastTime = times.reduce((a, b) => Math.max(a, b));
  return {
    name: commits[0]?.author.name ?? "",
    email: commits[0]?.author.email ?? "",
    commits: commits.length,
    agentAssistedCommits: commits.filter(
      (commit) => commit.class === "agent-assisted",
    ).length,
    activeDays: new Set(
      commits.map((commit) => localDayOf(commit.time, commit.offsetMinutes)),
    ).size,
    ...countCodeLines(commits, isCodePath),
    firstCommitAt: isoOf(times.reduce((a, b) => Math.min(a, b))),
    lastCommitAt: isoOf(lastTime),
    active: isActiveWithin(lastTime, now, ACTIVE_DAYS),
    areas: topAreas(commits, scope),
    weekly: weeklyCommits(times, now),
    status: contributorStatus(firstEverTime, lastTime, now),
    badges: [],
  };
};

/**
 * The `contributors` section, sorted by commits descending, then name. `activeDays`
 * counts distinct local dates; `active` means a commit in the 183 days before
 * `now`; `areas` are the three directories with the most commits, cut at two
 * levels below the scope; `weekly`, `status` and `badges` serve the contributor card.
 */
export const contributors = ({
  commits,
  history,
  ...context
}: ContributorsInput): Report["contributors"] => {
  const firstEverTimes = new Map(
    [...byEmail(history)].map(([email, own]) => [
      email,
      own.reduce((first, { time }) => Math.min(first, time), Infinity),
    ]),
  );
  return [...byEmail(commits)]
    .map(([email, own]) =>
      contributorOf(own, firstEverTimes.get(email) ?? Infinity, context),
    )
    .toSorted(byCommitsThenName);
};

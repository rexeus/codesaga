// Owns the highlights that name an event in the history: anniversary, newcomers, rename record and biggest cleanup.
// Separate from `rhythm.ts` because these read what a commit changed or who it came from, not when it landed.
// Cost: one pass over the commits.

import { DateTime } from "effect";

import { isoDateOfDay, localDayOf } from "../activity/buckets.js";
import { isContributorCommit } from "../automation/classify.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { countCodeLines } from "../history/history.js";
import type { Highlight } from "../report/highlights.js";
import { countOf, nounOf, quotedSubject } from "../report/sentences.js";
import type { HighlightFacts } from "./highlights.js";
import { HIGHLIGHT_THRESHOLDS } from "./thresholds.js";

const {
  anniversaryWindowDays,
  newcomersMinPeople,
  newcomerDays,
  cleanupMinNetDeletedLines,
  renameRecordMinRenames,
} = HIGHLIGHT_THRESHOLDS;

const SECONDS_PER_DAY = 86_400;
const MILESTONE_DAYS = [100, 500, 1000];
const MAX_NEWCOMERS_NAMED = 5;

type Milestone = {
  readonly day: number;
  readonly value: number;
  readonly unit: "years" | "days";
  readonly label: string;
};

/** The day (days since the epoch, UTC) of a calendar date; the day of a missing date rolls over. */
const dayOfDate = (year: number, month: number, date: number): number =>
  Date.UTC(year, month, date) / 1000 / SECONDS_PER_DAY;

/** The yearly and the 100-, 500- and 1000-day anniversaries of the first commit day, oldest first. */
const milestonesOf = (firstDay: number, nowDay: number): Array<Milestone> => {
  const first = new Date(firstDay * SECONDS_PER_DAY * 1000);
  const years = Array.from(
    {
      length:
        new Date(nowDay * SECONDS_PER_DAY * 1000).getUTCFullYear() -
        first.getUTCFullYear() +
        1,
    },
    (_, index): Milestone => ({
      day: dayOfDate(
        first.getUTCFullYear() + index + 1,
        first.getUTCMonth(),
        first.getUTCDate(),
      ),
      value: index + 1,
      unit: "years",
      label: nounOf(index + 1, "year"),
    }),
  );
  const days = MILESTONE_DAYS.map((count): Milestone => ({
    day: firstDay + count,
    value: count,
    unit: "days",
    label: nounOf(count, "day"),
  }));
  return [...years, ...days];
};

const dayOneOf = ({ subject, author }: ClassifiedCommit): string =>
  subject === ""
    ? ""
    : ` Day one was ${quotedSubject(subject)} by ${author.name}.`;

const anniversaryHighlight = (
  first: ClassifiedCommit,
  nowSeconds: number,
): ReadonlyArray<Highlight> => {
  const nowDay = Math.floor(nowSeconds / SECONDS_PER_DAY);
  const [nearest] = milestonesOf(localDayOf(first.time, 0), nowDay)
    .filter(({ day }) => Math.abs(day - nowDay) <= anniversaryWindowDays)
    .toSorted((a, b) => Math.abs(a.day - nowDay) - Math.abs(b.day - nowDay));
  if (nearest === undefined) {
    return [];
  }
  return [
    {
      kind: "anniversary",
      title: "Anniversary",
      detail: `The first commit ${nearest.day > nowDay ? "turns" : "turned"} ${nearest.label} old on ${isoDateOfDay(nearest.day)}.${dayOneOf(first)}`,
      value: nearest.value,
      unit: nearest.unit,
      date: isoDateOfDay(nearest.day),
    },
  ];
};

type Contributor = {
  readonly name: string;
  readonly email: string;
  readonly firstTime: number;
};

/** The people with a human or agent-assisted commit, with the time of their first one. */
const contributorsOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
): ReadonlyArray<Contributor> => {
  const byEmail = new Map<string, Contributor>();
  for (const commit of commits) {
    if (isContributorCommit(commit)) {
      const { name, email } = commit.author;
      const before = byEmail.get(email);
      byEmail.set(email, {
        name,
        email,
        firstTime: Math.min(before?.firstTime ?? Infinity, commit.time),
      });
    }
  }
  return [...byEmail.values()];
};

/** Newcomers are named by first commit, then email; a team that is all newcomers has none. */
const newcomersHighlight = (
  commits: ReadonlyArray<ClassifiedCommit>,
  nowSeconds: number,
): ReadonlyArray<Highlight> => {
  const contributors = contributorsOf(commits);
  const newcomers = contributors
    .filter(
      ({ firstTime }) =>
        firstTime >= nowSeconds - newcomerDays * SECONDS_PER_DAY,
    )
    .toSorted(
      (a, b) => a.firstTime - b.firstTime || a.email.localeCompare(b.email),
    );
  if (
    newcomers.length < newcomersMinPeople ||
    newcomers.length === contributors.length
  ) {
    return [];
  }
  return [
    {
      kind: "newcomers",
      title: "Newcomers",
      detail: `${countOf(newcomers.length)} of ${nounOf(contributors.length, "contributor")} made their first commit in the last ${newcomerDays} days.`,
      value: newcomers.length,
      people: newcomers
        .slice(0, MAX_NEWCOMERS_NAMED)
        .map(({ name, email }) => ({ name, email })),
    },
  ];
};

const cleanupSubject = ({ subject }: ClassifiedCommit): string =>
  subject === "" ? "" : `: ${quotedSubject(subject)}`;

const biggestCleanupHighlight = (
  commits: ReadonlyArray<ClassifiedCommit>,
  isCodePath: (path: string) => boolean,
): ReadonlyArray<Highlight> => {
  const net = commits.map((commit) => {
    const { added, deleted } = countCodeLines([commit], isCodePath);
    return { commit, removed: deleted - added };
  });
  const biggest = net.reduce<
    { commit: ClassifiedCommit; removed: number } | undefined
  >(
    (best, entry) => (entry.removed > (best?.removed ?? 0) ? entry : best),
    undefined,
  );
  if (biggest === undefined || biggest.removed < cleanupMinNetDeletedLines) {
    return [];
  }
  return [
    {
      kind: "biggest-cleanup",
      title: "Biggest cleanup",
      detail: `One commit removed ${countOf(biggest.removed)} more code lines than it added${cleanupSubject(biggest.commit)}.`,
      value: biggest.removed,
      date: isoDateOfDay(localDayOf(biggest.commit.time, 0)),
    },
  ];
};

const renameRecordHighlight = (
  commits: ReadonlyArray<ClassifiedCommit>,
): ReadonlyArray<Highlight> => {
  const renames = new Map<string, number>();
  for (const { changes } of commits) {
    for (const { path, renamed, previousLife } of changes) {
      if (renamed === true && previousLife !== true) {
        renames.set(path, (renames.get(path) ?? 0) + 1);
      }
    }
  }
  const [record] = [...renames].toSorted(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  if (record === undefined || record[1] < renameRecordMinRenames) {
    return [];
  }
  return [
    {
      kind: "rename-record",
      title: "Rename record",
      detail: `${record[0]} was renamed ${nounOf(record[1], "time")} and kept its history.`,
      value: record[1],
      path: record[0],
    },
  ];
};

/**
 * The `anniversary`, `newcomers`, `rename-record` and `biggest-cleanup`
 * findings that pass their thresholds. An anniversary (every year, or 100, 500
 * or 1000 days) falls within `anniversaryWindowDays` of today; newcomers made
 * their first commit in the last `newcomerDays` days, while others started
 * earlier; the biggest cleanup is the commit with the most net deleted code
 * lines; the rename record is the file renamed most often.
 */
export const historyEventHighlights = ({
  commits,
  now,
  isCodePath,
}: HighlightFacts): ReadonlyArray<Highlight> => {
  const nowSeconds = DateTime.toEpochMillis(now) / 1000;
  const first = commits.reduce<ClassifiedCommit | undefined>(
    (oldest, commit) =>
      oldest === undefined || commit.time <= oldest.time ? commit : oldest,
    undefined,
  );
  return [
    ...(first === undefined ? [] : anniversaryHighlight(first, nowSeconds)),
    ...newcomersHighlight(commits, nowSeconds),
    ...biggestCleanupHighlight(commits, isCodePath),
    ...renameRecordHighlight(commits),
  ];
};

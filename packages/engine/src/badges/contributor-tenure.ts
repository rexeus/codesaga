// Owns the badges that read when a contributor committed rather than what: steady, welcome and returning.
// Apart from `contributor-badges.ts` because they need only the commit times and the calendar.
// Cost: one pass over the contributor's commit times per rule.

import { DateTime } from "effect";

import { isoDateOfDay, localDayOf } from "../activity/buckets.js";
import { addMonths } from "../activity/calendar.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { ACTIVE_DAYS, isActiveWithin } from "../contributors/activeness.js";
import {
  NEW_CONTRIBUTOR_DAYS,
  isNewContributor,
} from "../contributors/status.js";
import type { ContributorBadge } from "../report/badges.js";

/** The rules behind steady, welcome and returning, for the report's `thresholds.badges`. */
export const TENURE_BADGE_THRESHOLDS = {
  steadyMonths: 6,
  welcomeDays: NEW_CONTRIBUTOR_DAYS,
  returningGapDays: 183,
};

const { steadyMonths, returningGapDays } = TENURE_BADGE_THRESHOLDS;

const SECONDS_PER_DAY = 86_400;

type Tenure = {
  readonly times: ReadonlyArray<number>;
  /** The time of the first commit of anyone who counts as a contributor. */
  readonly repositoryStart: number;
  readonly now: DateTime.Utc;
  readonly nowSeconds: number;
};

const dateOf = (time: number): string => isoDateOfDay(localDayOf(time, 0));

/** A commit in each of the last `steadyMonths` calendar months back from now. */
const steady = ({ times, nowSeconds }: Tenure) =>
  Array.from({ length: steadyMonths }, (_, index) => ({
    from: addMonths(nowSeconds, -(index + 1)),
    to: addMonths(nowSeconds, -index),
  })).every(({ from, to }) => times.some((time) => time > from && time <= to))
    ? {
        kind: "steady" as const,
        label: "Steady",
        evidence: `A commit in each of the last ${steadyMonths} months.`,
      }
    : undefined;

/** The first commit is recent, and someone committed before it: the founder of a young repository is no newcomer. */
const welcome = ({ times, repositoryStart, now, nowSeconds }: Tenure) => {
  const first = times.reduce((earliest, time) => Math.min(earliest, time));
  return isNewContributor(first, repositoryStart, now)
    ? {
        kind: "welcome" as const,
        label: "Welcome",
        evidence: `First commit on ${dateOf(first)}, ${Math.floor((nowSeconds - first) / SECONDS_PER_DAY)} days ago.`,
      }
    : undefined;
};

/** The latest pause of at least `returningGapDays` days that ended with a commit in the activity window. */
const returning = ({ times, now }: Tenure) => {
  const sorted = times.toSorted((a, b) => a - b);
  const back = sorted
    .map((time, index) => ({ time, gap: time - (sorted[index - 1] ?? time) }))
    .findLast(
      ({ time, gap }) =>
        gap >= returningGapDays * SECONDS_PER_DAY &&
        isActiveWithin(time, now, ACTIVE_DAYS),
    );
  return back === undefined
    ? undefined
    : {
        kind: "returning" as const,
        label: "Returning",
        evidence: `Back on ${dateOf(back.time)} after ${Math.floor(back.gap / SECONDS_PER_DAY)} days without a commit.`,
      };
};

/**
 * Steady (a commit in each of the last 6 months), welcome (the first commit
 * is at most 90 days old, and someone committed earlier) and returning (active again after a pause of at
 * least 183 days), in that order, for the person's commits over the full
 * history.
 */
export const tenureBadges = (
  commits: ReadonlyArray<ClassifiedCommit>,
  repositoryStart: number,
  now: DateTime.Utc,
): ReadonlyArray<ContributorBadge> => {
  const tenure = {
    times: commits.map(({ time }) => time),
    repositoryStart,
    now,
    nowSeconds: DateTime.toEpochMillis(now) / 1000,
  };
  return [steady, welcome, returning].flatMap((rule) => rule(tenure) ?? []);
};

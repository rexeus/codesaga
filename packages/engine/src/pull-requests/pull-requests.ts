// Owns the pull requests section: counts, median times and who authors and reviews, over the pull requests GitHub returned.
// A pure function over plain records, so no test needs the network.

import { toEpochSeconds } from "../analyze/analysis-window.js";
import type { TimeRange } from "../analyze/analysis-window.js";
import { isBotAccount } from "../automation/classify.js";
import { roundReported } from "../report/precision.js";
import type { PullRequests } from "../report/pull-requests.js";

/** A review as GitHub recorded it; a pending one has no `submittedAt` and is not a record. */
type ReviewRecord = {
  readonly author: string;
  /** GitHub's review state, such as `APPROVED` or `COMMENTED`. */
  readonly state: string;
  readonly submittedAt: string;
};

/** A pull request with the facts the section needs. Bot logins end in `[bot]`, `-bot` or `_bot`; a deleted account is `ghost`. */
export type PullRequestRecord = {
  readonly number: number;
  readonly author: string;
  readonly createdAt: string;
  readonly mergedAt: string | null;
  readonly closedAt: string | null;
  readonly reviews: ReadonlyArray<ReviewRecord>;
};

export type PullRequestsInput = {
  readonly host: string;
  readonly repository: string;
  readonly pulls: ReadonlyArray<PullRequestRecord>;
  /** More pull requests matched than `pulls` holds. */
  readonly truncated: boolean;
  /** Some pull request has more reviews than `pulls` holds. */
  readonly reviewsTruncated: boolean;
  /** The activity window; pull requests and reviews outside it do not count. */
  readonly window: TimeRange;
  /** The window's calendar months as `YYYY-MM`, oldest first. */
  readonly months: ReadonlyArray<string>;
};

const SECONDS_PER_HOUR = 3600;
const MONTH_LENGTH = "YYYY-MM".length;

const GHOST = "ghost";

/** Bots and deleted accounts are counted but never named: `ghost` stands for every deleted account at once. */
const isNamed = (login: string): boolean =>
  !isBotAccount(login) && login !== GHOST;

/** A review by the pull request's author; `ghost` never reviews itself, as it may be two people. */
const isSelfReview = (pull: PullRequestRecord, author: string): boolean =>
  author === pull.author && author !== GHOST;

const compareText = (left: string, right: string): number =>
  left < right ? -1 : Number(left > right);

/** The middle value, or the mean of the two middle values; null without values. */
const median = (values: ReadonlyArray<number>): number | null => {
  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const high = sorted[middle];
  const low = sorted[middle - 1];
  if (high === undefined) {
    return null;
  }
  return roundReported(
    sorted.length % 2 === 1 || low === undefined ? high : (low + high) / 2,
  );
};

const hoursBetween = (from: string, to: string): number =>
  (toEpochSeconds(to) - toEpochSeconds(from)) / SECONDS_PER_HOUR;

const increment = <K>(counts: Map<K, number>, key: K): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

type Tally = Pick<PullRequests, "authors" | "reviewers">;

/** Per person, the pull requests they opened and merged and the reviews they gave others. */
const tally = (
  opened: ReadonlyArray<PullRequestRecord>,
  merged: ReadonlyArray<PullRequestRecord>,
  reviews: ReadonlyArray<{ readonly author: string; readonly state: string }>,
): Tally => {
  const openedBy = new Map<string, number>();
  const mergedBy = new Map<string, number>();
  const reviewsBy = new Map<string, number>();
  const approvalsBy = new Map<string, number>();
  for (const pull of opened.filter(({ author }) => isNamed(author))) {
    increment(openedBy, pull.author);
  }
  for (const pull of merged.filter(({ author }) => isNamed(author))) {
    increment(mergedBy, pull.author);
  }
  for (const review of reviews.filter(({ author }) => isNamed(author))) {
    increment(reviewsBy, review.author);
    if (review.state === "APPROVED") {
      increment(approvalsBy, review.author);
    }
  }
  const authors = new Set([...openedBy.keys(), ...mergedBy.keys()]);
  return {
    authors: [...authors]
      .map((login) => ({
        login,
        opened: openedBy.get(login) ?? 0,
        merged: mergedBy.get(login) ?? 0,
      }))
      .toSorted(
        (left, right) =>
          right.opened - left.opened ||
          right.merged - left.merged ||
          compareText(left.login, right.login),
      ),
    reviewers: [...reviewsBy.keys()]
      .map((login) => ({
        login,
        reviews: reviewsBy.get(login) ?? 0,
        approvals: approvalsBy.get(login) ?? 0,
      }))
      .toSorted(
        (left, right) =>
          right.reviews - left.reviews ||
          right.approvals - left.approvals ||
          compareText(left.login, right.login),
      ),
  };
};

/** Hours from opening to the first review by a person other than the author; null when none came. */
const hoursToFirstReview = (pull: PullRequestRecord): number | null => {
  const first = pull.reviews
    .filter(
      ({ author }) => !isSelfReview(pull, author) && !isBotAccount(author),
    )
    .map(({ submittedAt }) => toEpochSeconds(submittedAt))
    .reduce<number | null>(
      (earliest, time) => (earliest === null ? time : Math.min(earliest, time)),
      null,
    );
  return first === null
    ? null
    : (first - toEpochSeconds(pull.createdAt)) / SECONDS_PER_HOUR;
};

const countInMonth = (
  month: string,
  times: ReadonlyArray<string | null>,
): number =>
  times.filter((time) => time?.slice(0, MONTH_LENGTH) === month).length;

/**
 * Builds the section from the pull requests fetched for the window. A pull
 * request counts as opened when it was created in the window and as merged
 * or closed when that happened in it; a review counts when it was submitted in
 * it, by someone other than the pull request's author. Bots and deleted
 * accounts (`ghost`) are counted in the totals but named in neither list.
 */
export const pullRequestsSection = ({
  host,
  repository,
  pulls,
  truncated,
  reviewsTruncated,
  window,
  months,
}: PullRequestsInput): PullRequests => {
  const from = toEpochSeconds(window.since);
  const to = toEpochSeconds(window.until);
  const within = (time: string | null): time is string =>
    time !== null && toEpochSeconds(time) >= from && toEpochSeconds(time) <= to;
  const opened = pulls.filter(({ createdAt }) => within(createdAt));
  const merged = pulls.filter(({ mergedAt }) => within(mergedAt));
  const reviews = pulls.flatMap((pull) =>
    pull.reviews.filter(
      ({ author, submittedAt }) =>
        !isSelfReview(pull, author) && within(submittedAt),
    ),
  );
  const people = tally(opened, merged, reviews);
  return {
    host,
    repository,
    fetched: pulls.length,
    truncated,
    reviewsTruncated,
    opened: opened.length,
    merged: merged.length,
    closedUnmerged: pulls.filter(
      ({ mergedAt, closedAt }) => mergedAt === null && within(closedAt),
    ).length,
    medianHoursToMerge: median(
      merged.flatMap(({ createdAt, mergedAt }) =>
        mergedAt === null ? [] : [hoursBetween(createdAt, mergedAt)],
      ),
    ),
    medianHoursToFirstReview: median(
      opened.flatMap((pull) => hoursToFirstReview(pull) ?? []),
    ),
    months: months.map((month) => ({
      month,
      opened: countInMonth(
        month,
        opened.map(({ createdAt }) => createdAt),
      ),
      merged: countInMonth(
        month,
        merged.map(({ mergedAt }) => mergedAt),
      ),
    })),
    ...people,
    totals: {
      authors: people.authors.length,
      reviewers: people.reviewers.length,
    },
  };
};

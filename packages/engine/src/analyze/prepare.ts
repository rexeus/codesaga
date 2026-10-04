// Owns preparing the gathered facts for the sections: scope, classification and the activity window.
// Pure, so `analyze` and `inspect` read the same commits and the same window without git.

import { DateTime } from "effect";

import { classifyCommit, humanCoAuthorsOf } from "../automation/classify.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import type { HistoryCommit } from "../history/history.js";
import { buildIdentities } from "../people/identities.js";
import { isoOfEpochSeconds, toEpochSeconds } from "./analysis-window.js";
import type { TimeRange } from "./analysis-window.js";
import type { RepositoryFacts } from "./gather.js";

const isUnder = (path: string, scope: string): boolean =>
  path === scope || path.startsWith(`${scope}/`);

/** A commit cut to the scope, with the number of files it changed before the cut. */
type ScopedCommit = HistoryCommit & { readonly changedFiles: number };

/** The commits with a change under `scope`, with only those changes; empty commits count for the whole repository. */
const inScope = (
  commits: ReadonlyArray<HistoryCommit>,
  scope: string,
): ReadonlyArray<ScopedCommit> =>
  commits.flatMap((commit) => {
    const changedFiles = commit.changes.length;
    if (scope === ".") {
      return [{ ...commit, changedFiles }];
    }
    const changes = commit.changes.filter(({ path }) => isUnder(path, scope));
    return changes.length === 0 ? [] : [{ ...commit, changes, changedFiles }];
  });

const classify = (
  commits: ReadonlyArray<ScopedCommit>,
  signatures: RepositoryFacts["signatures"],
): ReadonlyArray<ClassifiedCommit> => {
  const identities = buildIdentities(
    commits.map(({ author, time }) => ({ ...author, time })),
  );
  return commits.map((commit) => {
    const { class: commitClass, tools } = classifyCommit(commit, signatures);
    const email = commit.author.email.toLowerCase();
    return {
      class: commitClass,
      tools,
      time: commit.time,
      offsetMinutes: commit.offsetMinutes,
      subject: commit.subject,
      author: identities.get(email) ?? { email, name: commit.author.name },
      humanCoAuthors: humanCoAuthorsOf(commit, signatures),
      changes: commit.changes,
      changedFiles: commit.changedFiles,
    };
  });
};

/** The oldest and newest commit time in seconds, or undefined without commits. */
const timeExtent = (
  commits: ReadonlyArray<ClassifiedCommit>,
): { readonly first: number; readonly last: number } | undefined =>
  commits.length === 0
    ? undefined
    : {
        first: commits.reduce((min, { time }) => Math.min(min, time), Infinity),
        last: commits.reduce((max, { time }) => Math.max(max, time), -Infinity),
      };

/** The facts, cut to the scope, classified and narrowed to the window. */
export type Analysis = {
  /** The scope's commits over the full history, newest first, each before its parents. */
  readonly scoped: ReadonlyArray<ClassifiedCommit>;
  /** The scoped commits inside `window`. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  readonly window: TimeRange;
  /**
   * The scoped commits in the span before `window`, when comparing; the span
   * includes its `since` and excludes its `until`, which `window` owns.
   */
  readonly previous:
    | {
        readonly window: TimeRange;
        /** Whether `window` starts before the first scoped commit. */
        readonly partial: boolean;
        readonly commits: ReadonlyArray<ClassifiedCommit>;
      }
    | undefined;
  /** Author time in seconds of the HEAD commit itself, even a merge; 0 on an unborn branch. */
  readonly headTime: number;
  /** ISO timestamps of the oldest and newest scoped commit; null without commits. */
  readonly firstCommitAt: string | null;
  readonly lastCommitAt: string | null;
};

/** Whether a commit time lies between the Unix epoch and `now`, the only times a window ending now can place. */
const isPlaceable = (seconds: number, now: DateTime.Utc): boolean =>
  seconds >= 0 && seconds <= DateTime.toEpochMillis(now) / 1000;

const previousOf = (
  scoped: ReadonlyArray<ClassifiedCommit>,
  window: TimeRange | undefined,
  firstCommit: number | undefined,
): Analysis["previous"] => {
  if (window === undefined) {
    return undefined;
  }
  const from = toEpochSeconds(window.since);
  const until = toEpochSeconds(window.until);
  return {
    window,
    partial: firstCommit !== undefined && from < firstCommit,
    commits: scoped.filter(({ time }) => time >= from && time < until),
  };
};

/**
 * Cuts the commits to the repository scope, classifies them, and resolves the
 * activity window: `since` or the first commit in scope, until now, and the
 * span before it when comparing. Commits
 * dated before the epoch or after `now` count nowhere, not even in
 * `firstCommitAt` and `lastCommitAt`.
 */
export const prepareAnalysis = (facts: RepositoryFacts): Analysis => {
  const placeable = facts.commits.filter(({ time }) =>
    isPlaceable(time, facts.now),
  );
  const scoped = classify(
    inScope(placeable, facts.repository.scope),
    facts.signatures,
  );
  const extent = timeExtent(scoped);
  const until = DateTime.formatIso(facts.now);
  const window = {
    since:
      facts.since ??
      (extent === undefined ? until : isoOfEpochSeconds(extent.first)),
    until,
  };
  const from = toEpochSeconds(window.since);
  const to = toEpochSeconds(window.until);
  return {
    scoped,
    commits: scoped.filter(({ time }) => time >= from && time <= to),
    window,
    previous: previousOf(scoped, facts.previous, extent?.first),
    headTime: facts.headTime,
    firstCommitAt:
      extent === undefined ? null : isoOfEpochSeconds(extent.first),
    lastCommitAt: extent === undefined ? null : isoOfEpochSeconds(extent.last),
  };
};

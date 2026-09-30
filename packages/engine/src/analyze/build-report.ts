// Owns turning the facts analyze gathered into a Report: scope, classification, window and sections.
// Pure, so the composition is testable without git; analyze only gathers the facts.
// One pass per section over the scoped commits.

import { DateTime } from "effect";

import { activity } from "../activity/activity.js";
import { punchcard } from "../activity/punchcard.js";
import { automation } from "../automation/automation.js";
import { classifyCommit } from "../automation/classify.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { ACTIVE_DAYS } from "../contributors/activeness.js";
import { contributors } from "../contributors/contributors.js";
import type { HistoryCommit } from "../history/history.js";
import { overview } from "../overview/overview.js";
import { buildIdentities } from "../people/identities.js";
import type { Report } from "../report/report.js";
import type { InventoryFile } from "../universe/inventory.js";
import { toEpochSeconds } from "./analysis-window.js";

/** Everything `buildReport` needs; gathering it is analyze's job. */
export type ReportFacts = {
  readonly toolVersion: string;
  readonly now: DateTime.Utc;
  /** The resolved `--since` instant, or undefined for the first commit in scope. */
  readonly since: string | undefined;
  readonly repository: Omit<
    Report["repository"],
    "firstCommitAt" | "lastCommitAt"
  >;
  /** The whole history, newest first; times outside the epoch-to-`now` range are ignored. */
  readonly commits: ReadonlyArray<HistoryCommit>;
  readonly universe: ReadonlyArray<InventoryFile>;
  /** Whether a path counts as code, for files that no longer exist too. */
  readonly isCodePath: (path: string) => boolean;
};

const isoOf = (seconds: number): string =>
  DateTime.formatIso(DateTime.makeUnsafe(seconds * 1000));

const isUnder = (path: string, scope: string): boolean =>
  path === scope || path.startsWith(`${scope}/`);

/** The commits with a change under `scope`, with only those changes; empty commits count for the whole repository. */
const inScope = (
  commits: ReadonlyArray<HistoryCommit>,
  scope: string,
): ReadonlyArray<HistoryCommit> =>
  scope === "."
    ? commits
    : commits.flatMap((commit) => {
        const changes = commit.changes.filter(({ path }) =>
          isUnder(path, scope),
        );
        return changes.length === 0 ? [] : [{ ...commit, changes }];
      });

const classify = (
  commits: ReadonlyArray<HistoryCommit>,
): ReadonlyArray<ClassifiedCommit> => {
  const identities = buildIdentities(
    commits.map(({ author, time }) => ({ ...author, time })),
  );
  return commits.map((commit) => {
    const { class: commitClass, tool } = classifyCommit(commit);
    const email = commit.author.email.toLowerCase();
    return {
      class: commitClass,
      tool,
      time: commit.time,
      offsetMinutes: commit.offsetMinutes,
      author: identities.get(email) ?? { email, name: commit.author.name },
      changes: commit.changes,
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

/** Whether a commit time lies between the Unix epoch and `now`, the only times a window ending now can place. */
const isPlaceable = (seconds: number, now: DateTime.Utc): boolean =>
  seconds >= 0 && seconds <= DateTime.toEpochMillis(now) / 1000;

/**
 * Builds the report from the facts: commits are cut to the repository scope,
 * classified, and narrowed to the activity window before the sections see them.
 * Commits dated before the epoch or after `now` count nowhere, not even in
 * `firstCommitAt` and `lastCommitAt`.
 */
export const buildReport = (facts: ReportFacts): Report => {
  const { scope } = facts.repository;
  const placeable = facts.commits.filter(({ time }) =>
    isPlaceable(time, facts.now),
  );
  const scoped = classify(inScope(placeable, scope));
  const extent = timeExtent(scoped);
  const until = DateTime.formatIso(facts.now);
  const window = {
    since: facts.since ?? (extent === undefined ? until : isoOf(extent.first)),
    until,
  };
  const from = toEpochSeconds(window.since);
  const to = toEpochSeconds(window.until);
  const commits = scoped.filter(({ time }) => time >= from && time <= to);
  const people = contributors({
    commits,
    scope,
    now: facts.now,
    isCodePath: facts.isCodePath,
  });
  return {
    schemaVersion: 1,
    tool: { name: "codesaga", version: facts.toolVersion },
    generatedAt: until,
    repository: {
      ...facts.repository,
      firstCommitAt: extent === undefined ? null : isoOf(extent.first),
      lastCommitAt: extent === undefined ? null : isoOf(extent.last),
    },
    window: { ...window, commits: commits.length },
    thresholds: { activeDays: ACTIVE_DAYS },
    totals: { contributors: people.length },
    overview: overview({ commits, universe: facts.universe, now: facts.now }),
    activity: activity({ commits, window, isCodePath: facts.isCodePath }),
    punchcard: punchcard(commits),
    contributors: people,
    automation: automation({ commits, window }),
  };
};

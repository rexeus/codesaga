// Tests only: facts and commits for the contributor badge rules, without git.
import { DateTime } from "effect";

import type { ClassifiedCommit } from "../automation/classify.js";
import type { ContributorBadgeFacts } from "../badges/contributor-badges.js";
import { contributorBadges } from "../badges/contributor-badges.js";
import { at, classifiedCommit } from "./classified-commit.js";

// The clock of the badge tests: 2026-07-01T00:00:00Z.
export const badgeNow = DateTime.makeUnsafe("2026-07-01T00:00:00Z");

/** The email of the commits `classifiedCommit` makes. */
export const ada = "ada@example.com";

/** The time `days` days before `badgeNow`, in epoch seconds. */
export const daysAgo = (days: number): number =>
  at("2026-07-01T00:00:00Z") - days * 86_400;

/** A human commit at `time` that adds one line to each of `paths`, and deletes `deleted` lines from each. */
export const commit = (
  time: number,
  paths: ReadonlyArray<string> = ["src/a.ts"],
  deleted = 0,
  overrides: Partial<ClassifiedCommit> = {},
): ClassifiedCommit =>
  classifiedCommit({
    time,
    changes: paths.map((path) => ({ path, added: 1, deleted })),
    ...overrides,
  });

/** `count` commits more than a year back, the lazy kind: no badge besides what a test adds. */
export const old = (
  count: number,
  paths?: ReadonlyArray<string>,
): ReadonlyArray<ClassifiedCommit> =>
  Array.from({ length: count }, (_, i) => commit(daysAgo(400 + i), paths));

/** Facts for a repository of two contributors that began long ago, with `overrides` on top. */
export const badgeFacts = (
  commits: ReadonlyArray<ClassifiedCommit>,
  overrides: Partial<ContributorBadgeFacts> = {},
): ContributorBadgeFacts => ({
  commits: commits.toSorted((a, b) => b.time - a.time),
  now: badgeNow,
  isCodePath: (path) => path.endsWith(".ts"),
  repositoryStart: 0,
  historyContributors: 2,
  historyHasOtherOffsets: false,
  founded: { files: 0, ofFiles: 100 },
  ...overrides,
});

/** The kinds of the badges Ada earns with `commits`, in report order. */
export const kindsOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
  overrides: Partial<ContributorBadgeFacts> = {},
): ReadonlyArray<string> =>
  contributorBadges(ada, badgeFacts(commits, overrides)).map(
    ({ kind }) => kind,
  );

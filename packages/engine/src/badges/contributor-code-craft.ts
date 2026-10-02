// Owns the craft badges that read code facts: type-tightener, sweeper, simplifier and test-companion.
// They compare each TypeScript or JavaScript file before and after a person's own human commits of the last year; the evidence only ever counts what was removed or improved, never the inverse.
import { isActiveWithin } from "../contributors/activeness.js";
import { countOf, percentOf } from "../report/sentences.js";
import type { EarnedContributorBadge } from "./contributor-badge-category.js";
import type { BadgeContext } from "./contributor-badge-facts.js";
import { CONTRIBUTOR_BADGE_THRESHOLDS } from "./contributor-badge-thresholds.js";
import { commitDeltaOf } from "./craft-deltas.js";
import type { CommitDelta } from "./craft-deltas.js";

const {
  recentWindowDays,
  typeTightenerRemovedAny,
  typeTightenerMinCommits,
  sweeperRemovedDeclarations,
  simplifierFunctions,
  testCompanionCommits,
  testCompanionShare,
} = CONTRIBUTOR_BADGE_THRESHOLDS;

const sum = (
  deltas: ReadonlyArray<CommitDelta>,
  count: (delta: CommitDelta) => number,
) => deltas.reduce((total, delta) => total + count(delta), 0);

const typeTightener = (deltas: ReadonlyArray<CommitDelta>) => {
  const tightening = deltas.filter(({ removedAny }) => removedAny >= 1);
  const removed = sum(tightening, ({ removedAny }) => removedAny);
  return removed >= typeTightenerRemovedAny &&
    tightening.length >= typeTightenerMinCommits
    ? [
        {
          kind: "type-tightener" as const,
          label: "Type tightener",
          evidence: `Removed ${countOf(removed)} explicit any in the last year, in ${countOf(tightening.length)} commits that each removed some.`,
        },
      ]
    : [];
};

const sweeper = (deltas: ReadonlyArray<CommitDelta>) => {
  const removed = sum(deltas, ({ removedDeclarations }) => removedDeclarations);
  return removed >= sweeperRemovedDeclarations
    ? [
        {
          kind: "sweeper" as const,
          label: "Sweeper",
          evidence: `Removed ${countOf(removed)} more top-level functions, classes and arrow-function constants than added in the last year.`,
        },
      ]
    : [];
};

const simplifier = (deltas: ReadonlyArray<CommitDelta>) => {
  const simplified = sum(deltas, (delta) => delta.simplified);
  return simplified >= simplifierFunctions
    ? [
        {
          kind: "simplifier" as const,
          label: "Simplifier",
          evidence: `Lowered the cognitive complexity of ${countOf(simplified)} functions by 3 or more in the last year, without adding functions to their files.`,
        },
      ]
    : [];
};

const testCompanion = (deltas: ReadonlyArray<CommitDelta>) => {
  const adding = deltas.filter((delta) => delta.addedExportedFunction);
  const tested = adding.filter(
    ({ addedTestCases }) => addedTestCases > 0,
  ).length;
  return adding.length >= testCompanionCommits &&
    tested / adding.length >= testCompanionShare
    ? [
        {
          kind: "test-companion" as const,
          label: "Test companion",
          evidence: `${percentOf(tested / adding.length)} of their commits that add an exported function also add test cases (${countOf(tested)} of ${countOf(adding.length)}).`,
        },
      ]
    : [];
};

/**
 * The code-craft badges of the person, from their human commits of the last
 * `recentWindowDays` days: agent-assisted commits are the agent's work, and
 * mass changes are left out (see `commitDeltaOf`). Withheld without
 * `factsLookup`, when the history's TypeScript was not parsed.
 */
export const codeCraftBadges = ({
  commits,
  now,
  factsLookup,
}: BadgeContext): ReadonlyArray<EarnedContributorBadge> => {
  if (factsLookup === undefined) {
    return [];
  }
  const deltas = commits
    .filter(
      ({ class: commitClass, time }) =>
        commitClass === "human" && isActiveWithin(time, now, recentWindowDays),
    )
    .flatMap(({ changes }) => commitDeltaOf(changes, factsLookup) ?? []);
  return [
    ...typeTightener(deltas),
    ...sweeper(deltas),
    ...simplifier(deltas),
    ...testCompanion(deltas),
  ];
};

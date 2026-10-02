// Owns the badges of one territory: which badges its knowledge state and history earn, in priority order.
// Apart from the partition because the rules read commits and peers; the thresholds live in `territory-badge-thresholds.ts`.
// Cost: constant work per territory over the numbers the caller gathered, plus one pass over its files and first commits.

import { DateTime } from "effect";

import { isoDateOfDay, localDayOf } from "../activity/buckets.js";
import { ACTIVE_DAYS, isActiveWithin } from "../contributors/activeness.js";
import { ORPHANED_SHARE } from "../knowledge/file-set.js";
import type { TerritoryBadge } from "../report/badges.js";
import { nounOf, percentOf } from "../report/sentences.js";
import { isTestPath } from "../universe/path-kinds.js";
import { churning, deeplyNested, heavyweight, hotspot } from "./code-badges.js";
import { withCategory } from "./territory-badge-category.js";
import type { EarnedBadge } from "./territory-badge-category.js";
import type {
  TerritoryBadgeInput,
  TerritoryExpert,
} from "./territory-badge-facts.js";
import { TERRITORY_BADGE_THRESHOLDS } from "./territory-badge-thresholds.js";
import {
  complexLogic,
  inACycle,
  strict,
  typeSafe,
} from "./typescript-badges.js";

const {
  sharedActiveExperts,
  sharedTruckFactor,
  fadingFromDays,
  fadingToDays,
  newTerritoryDays,
  newTerritoryAfterStartDays,
  handoverDays,
  inFocusDays,
  quietDays,
  newcomerFriendlyFirstCommits,
  newcomerFriendlyDays,
  wellTestedShare,
} = TERRITORY_BADGE_THRESHOLDS;

const SECONDS_PER_DAY = 86_400;

type Context = TerritoryBadgeInput & {
  readonly now: DateTime.Utc;
  readonly nowSeconds: number;
  readonly activeExperts: ReadonlyArray<TerritoryExpert>;
};

const daysSince = (time: number, nowSeconds: number): number =>
  (nowSeconds - time) / SECONDS_PER_DAY;

const dateOf = (time: number): string => isoDateOfDay(localDayOf(time, 0));

const island = ({ island: isIsland, paths, experts }: Context) =>
  isIsland
    ? {
        kind: "island" as const,
        label: "Knowledge island",
        evidence: `One person is sole expert on ${experts.reduce((most, { soleFiles }) => Math.max(most, soleFiles), 0)} of ${paths.length} files.`,
      }
    : undefined;

const orphaned = ({ orphaned: isOrphaned, paths }: Context) =>
  isOrphaned
    ? {
        kind: "orphaned" as const,
        label: "Orphaned",
        evidence: `More than ${percentOf(ORPHANED_SHARE)} of the ${paths.length} files have no active expert.`,
      }
    : undefined;

const oneExpert = ({ island: isIsland, activeExperts, experts }: Context) =>
  activeExperts.length === 1 && !isIsland
    ? {
        kind: "one-expert" as const,
        label: "One expert",
        evidence:
          experts.length === 1
            ? "The territory's only expert is active."
            : `Only 1 of ${experts.length} experts is active.`,
      }
    : undefined;

const sharedKnowledge = ({ activeExperts, truckFactor }: Context) =>
  activeExperts.length >= sharedActiveExperts &&
  truckFactor >= sharedTruckFactor
    ? {
        kind: "shared-knowledge" as const,
        label: "Shared knowledge",
        evidence: `${activeExperts.length} active experts and a truck factor of ${truckFactor}.`,
      }
    : undefined;

const knowledgeFading = ({ experts, nowSeconds }: Context) => {
  const silent = Math.floor(
    daysSince(experts[0]?.lastTime ?? nowSeconds, nowSeconds),
  );
  return experts.length > 0 &&
    silent >= fadingFromDays &&
    silent <= fadingToDays
    ? {
        kind: "knowledge-fading" as const,
        label: "Knowledge fading",
        evidence: `The main expert last committed ${silent} days ago.`,
      }
    : undefined;
};

/**
 * The previous main expert (the dormant expert on the most files) is replaced
 * by an active main expert who first committed to the territory recently.
 */
const handover = ({ experts, now, nowSeconds }: Context) => {
  const [main] = experts;
  const previous = experts.find(
    (expert) => !isActiveWithin(expert.lastTime, now, ACTIVE_DAYS),
  );
  return main !== undefined &&
    previous !== undefined &&
    isActiveWithin(main.lastTime, now, ACTIVE_DAYS) &&
    isActiveWithin(main.firstTime, now, handoverDays)
    ? {
        kind: "handover" as const,
        label: "Handover",
        evidence: `A main expert who joined ${Math.floor((nowSeconds - main.firstTime) / SECONDS_PER_DAY)} days ago replaced the previous one, last active on ${dateOf(previous.lastTime)}.`,
      }
    : undefined;
};

const newTerritory = ({
  fileFirstCommits,
  startTime,
  now,
  nowSeconds,
}: Context) => {
  const created = fileFirstCommits.reduce(
    (earliest, time) => Math.min(earliest, time),
    Infinity,
  );
  return fileFirstCommits.length > 0 &&
    startTime !== undefined &&
    created - startTime >= newTerritoryAfterStartDays * SECONDS_PER_DAY &&
    isActiveWithin(created, now, newTerritoryDays)
    ? {
        kind: "new-territory" as const,
        label: "New territory",
        evidence: `Created on ${dateOf(created)}, ${Math.floor(daysSince(created, nowSeconds))} days ago.`,
      }
    : undefined;
};

const inFocus = ({ recentCommits, peerRecentCommits }: Context) =>
  recentCommits > 0 && recentCommits > peerRecentCommits
    ? {
        kind: "in-focus" as const,
        label: "In focus",
        evidence: `${nounOf(recentCommits, "commit")} in the last ${inFocusDays} days, the most of its sibling territories.`,
      }
    : undefined;

const quiet = ({ lastChangeTime, nowSeconds }: Context) =>
  lastChangeTime !== undefined &&
  daysSince(lastChangeTime, nowSeconds) >= quietDays
    ? {
        kind: "quiet" as const,
        label: "Quiet",
        evidence: `Unchanged since ${dateOf(lastChangeTime)}, ${Math.floor(daysSince(lastChangeTime, nowSeconds))} days.`,
      }
    : undefined;

const newcomerFriendly = ({ firstCommits, paths, nowSeconds }: Context) => {
  const inTerritory = new Set(paths);
  const newcomers = firstCommits.filter(
    ({ time, paths: changed }) =>
      daysSince(time, nowSeconds) <= newcomerFriendlyDays &&
      changed.some((path) => inTerritory.has(path)),
  ).length;
  return newcomers >= newcomerFriendlyFirstCommits
    ? {
        kind: "newcomer-friendly" as const,
        label: "Newcomer-friendly",
        evidence: `${newcomers} people made their first commit here in the last ${newcomerFriendlyDays} days.`,
      }
    : undefined;
};

/** A territory inside a test directory is made of tests by definition, so being well tested says nothing. */
const wellTested = ({ path, paths }: Context) => {
  const tests = paths.filter((file) => isTestPath(file)).length;
  return paths.length > 0 &&
    !isTestPath(`${path}/placeholder`) &&
    tests / paths.length >= wellTestedShare
    ? {
        kind: "well-tested" as const,
        label: "Well tested",
        evidence: `${tests} of ${paths.length} files (${percentOf(tests / paths.length)}) are tests.`,
      }
    : undefined;
};

const RULES: ReadonlyArray<(context: Context) => EarnedBadge | undefined> = [
  island,
  orphaned,
  oneExpert,
  sharedKnowledge,
  knowledgeFading,
  handover,
  newTerritory,
  inFocus,
  quiet,
  newcomerFriendly,
  heavyweight,
  hotspot,
  churning,
  deeplyNested,
  wellTested,
  ({ typescript }) => typeSafe(typescript),
  ({ typescript }) => strict(typescript),
  ({ typescript }) => complexLogic(typescript),
  ({ typescript }) => inACycle(typescript),
];

/**
 * The badges the territory earns, most important first: island, orphaned, one
 * expert, shared knowledge, knowledge fading, handover, new territory, in focus,
 * quiet, newcomer-friendly, heavyweight, hotspot, churning, deeply nested, well tested, type-safe, strict, complex logic, in a cycle. Each carries its rule and the numbers behind
 * it as evidence. An `other` territory earns none. Pure: the caller gathers the
 * input from the knowledge model and the commits.
 */
export const territoryBadges = (
  input: TerritoryBadgeInput,
  now: DateTime.Utc,
): ReadonlyArray<TerritoryBadge> => {
  if (input.kind === "other") {
    return [];
  }
  const context = {
    ...input,
    now,
    nowSeconds: DateTime.toEpochMillis(now) / 1000,
    activeExperts: input.experts.filter(({ lastTime }) =>
      isActiveWithin(lastTime, now, ACTIVE_DAYS),
    ),
  };
  return RULES.flatMap((rule) => {
    const earned = rule(context);
    return earned === undefined ? [] : [withCategory(earned)];
  });
};

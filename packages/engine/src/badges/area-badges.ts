// Owns the badges of one area: which achievements its knowledge state and history earn, in priority order.
// Apart from the partition because the rules read commits and peers; only the thresholds are part of the report.
// Cost: constant work per area over the numbers the caller gathered, plus one pass over its files and first commits.

import { DateTime } from "effect";

import { isoDateOfDay, localDayOf } from "../activity/buckets.js";
import { ACTIVE_DAYS, isActiveWithin } from "../contributors/activeness.js";
import { ORPHANED_SHARE } from "../knowledge/file-set.js";
import type { AreaBadge } from "../report/badges.js";
import { nounOf, percentOf } from "../report/sentences.js";
import { isTestPath } from "../universe/path-kinds.js";

/** The rules behind the area badges, for the report's `thresholds.badges`. */
export const AREA_BADGE_THRESHOLDS = {
  sharedActiveExperts: 3,
  sharedTruckFactor: 3,
  fadingFromDays: 90,
  fadingToDays: 183,
  newDays: 90,
  newAfterStartDays: 180,
  handoverDays: 180,
  quietDays: 183,
  newcomerFriendlyFirstCommits: 2,
  newcomerFriendlyDays: 180,
  wellTestedShare: 0.4,
};

const {
  sharedActiveExperts,
  sharedTruckFactor,
  fadingFromDays,
  fadingToDays,
  newDays,
  newAfterStartDays,
  handoverDays,
  quietDays,
  newcomerFriendlyFirstCommits,
  newcomerFriendlyDays,
  wellTestedShare,
} = AREA_BADGE_THRESHOLDS;

const SECONDS_PER_DAY = 86_400;

/** An expert of the area; times are seconds since the epoch. */
type AreaExpert = {
  /** Files of the area the person is an expert on. */
  readonly files: number;
  /** Files on which the person is the only expert. */
  readonly soleFiles: number;
  /** The person's first commit to a file of the area. */
  readonly firstTime: number;
  /** The person's last commit over the full history. */
  readonly lastTime: number;
};

/** What the rules read about one area; the caller gathers it from the knowledge model and the commits. */
export type AreaBadgeInput = {
  /** A `rest` area groups small leftovers and earns no badge. */
  readonly kind: "package" | "directory" | "rest";
  /** The area's universe files, repository-relative. */
  readonly paths: ReadonlyArray<string>;
  readonly truckFactor: number;
  readonly island: boolean;
  readonly orphaned: boolean;
  /** Every expert of the area, not only the five the report lists, most files first. */
  readonly experts: ReadonlyArray<AreaExpert>;
  /** For each of the area's files, the time of its first commit; their earliest is when the area was created. */
  readonly fileFirstCommits: ReadonlyArray<number>;
  /** The newest commit that touched any file of the area; undefined when none is known. */
  readonly lastChangeTime: number | undefined;
  /** Commits in the activity window that touched the area. */
  readonly commitsInWindow: number;
  /** The most commits in the activity window that touched any other area of the same level. */
  readonly peerCommitsInWindow: number;
  /** The time of the repository's first commit; an area is `new` only well after it. */
  readonly startTime: number;
  /** The first commit of every person who arrived after the repository started, with the paths it changed. */
  readonly firstCommits: ReadonlyArray<{
    readonly time: number;
    readonly paths: ReadonlyArray<string>;
  }>;
};

type Context = AreaBadgeInput & {
  readonly now: DateTime.Utc;
  readonly nowSeconds: number;
  readonly activeExperts: ReadonlyArray<AreaExpert>;
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

const singleExpert = ({ island: isIsland, activeExperts, experts }: Context) =>
  activeExperts.length === 1 && !isIsland
    ? {
        kind: "single-expert" as const,
        label: "Single expert",
        evidence:
          experts.length === 1
            ? "The area's only expert is active."
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
 * by an active main expert who first committed to the area recently.
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

const newArea = ({ fileFirstCommits, startTime, now, nowSeconds }: Context) => {
  const created = fileFirstCommits.reduce(
    (earliest, time) => Math.min(earliest, time),
    Infinity,
  );
  return fileFirstCommits.length > 0 &&
    created - startTime >= newAfterStartDays * SECONDS_PER_DAY &&
    isActiveWithin(created, now, newDays)
    ? {
        kind: "new" as const,
        label: "New",
        evidence: `Created on ${dateOf(created)}, ${Math.floor(daysSince(created, nowSeconds))} days ago.`,
      }
    : undefined;
};

const inFocus = ({ commitsInWindow, peerCommitsInWindow }: Context) =>
  commitsInWindow > 0 && commitsInWindow > peerCommitsInWindow
    ? {
        kind: "in-focus" as const,
        label: "In focus",
        evidence: `${nounOf(commitsInWindow, "commit")} in the window, the most of any area at this level.`,
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
  const inArea = new Set(paths);
  const newcomers = firstCommits.filter(
    ({ time, paths: changed }) =>
      daysSince(time, nowSeconds) <= newcomerFriendlyDays &&
      changed.some((path) => inArea.has(path)),
  ).length;
  return newcomers >= newcomerFriendlyFirstCommits
    ? {
        kind: "newcomer-friendly" as const,
        label: "Newcomer-friendly",
        evidence: `${newcomers} people made their first commit here in the last ${newcomerFriendlyDays} days.`,
      }
    : undefined;
};

const wellTested = ({ paths }: Context) => {
  const tests = paths.filter((path) => isTestPath(path)).length;
  return paths.length > 0 && tests / paths.length >= wellTestedShare
    ? {
        kind: "well-tested" as const,
        label: "Well tested",
        evidence: `${tests} of ${paths.length} files (${percentOf(tests / paths.length)}) are tests.`,
      }
    : undefined;
};

const RULES: ReadonlyArray<(context: Context) => AreaBadge | undefined> = [
  island,
  orphaned,
  singleExpert,
  sharedKnowledge,
  knowledgeFading,
  handover,
  newArea,
  inFocus,
  quiet,
  newcomerFriendly,
  wellTested,
];

/**
 * The badges the area earns, most important first: island, orphaned, single
 * expert, shared knowledge, knowledge fading, handover, new, in focus, quiet,
 * newcomer-friendly, well tested. Each carries its rule and the numbers behind
 * it as evidence. A `rest` area earns none. Pure: the caller gathers the
 * input from the knowledge model and the commits.
 */
export const areaBadges = (
  input: AreaBadgeInput,
  now: DateTime.Utc,
): ReadonlyArray<AreaBadge> => {
  if (input.kind === "rest") {
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
  return RULES.flatMap((rule) => rule(context) ?? []);
};

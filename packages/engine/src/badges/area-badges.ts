// @scaffold Owns the badges of one area: which achievements its knowledge state and history earn, in priority order.
// @scaffold Apart from the partition because the rules read commits and peers; only the thresholds are part of the report.
// @scaffold Cost: one pass over the commits per level, then constant work per area.

import type { DateTime } from "effect";

import type { TimeRange } from "../analyze/analysis-window.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import type { AreaWithFiles } from "../knowledge/areas.js";
import type { AreaBadge } from "../report/badges.js";

/** The rules behind the area badges, for the report's `thresholds.badges`. */
export const AREA_BADGE_THRESHOLDS = {
  sharedActiveExperts: 3,
  sharedTruckFactor: 3,
  fadingFromDays: 90,
  fadingToDays: 183,
  newDays: 90,
  quietDays: 183,
  newcomerFriendlyFirstCommits: 2,
  newcomerFriendlyDays: 180,
  wellTestedShare: 0.4,
};

export type AreaBadgeFacts = {
  /** The scope's classified commits over the full history, newest first. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  /** The activity window, which decides the area in focus. */
  readonly window: TimeRange;
  readonly now: DateTime.Utc;
  /** Whether a path is a test file. */
  readonly isTestPath: (path: string) => boolean;
  /** Every area of the same level, the peers the area in focus is chosen among. */
  readonly level: ReadonlyArray<AreaWithFiles>;
};

/**
 * The badges the area earns, most important first: island, orphaned, single
 * expert, shared knowledge, knowledge fading, handover, new, in focus, quiet,
 * newcomer-friendly, well tested. Each carries its rule and the numbers behind
 * it as evidence. A `rest` area earns none.
 */
export const areaBadges = (
  area: AreaWithFiles,
  facts: AreaBadgeFacts,
): ReadonlyArray<AreaBadge> => {
  throw new Error(`not implemented: ${area.path} ${facts.level.length}`);
};

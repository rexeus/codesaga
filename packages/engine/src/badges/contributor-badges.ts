// @scaffold Owns the badges of one contributor: which positive or neutral achievements their commits earn, in priority order.
// @scaffold Apart from the contributors section because the rules need the areas, the full history and, for reviews, GitHub.
// @scaffold Cost: one pass over the contributor's commits and the areas of one level.

import type { DateTime } from "effect";

import type { ClassifiedCommit } from "../automation/classify.js";
import { NEW_CONTRIBUTOR_DAYS } from "../contributors/status.js";
import type { AreaWithFiles } from "../knowledge/areas.js";
import type { ContributorBadge } from "../report/badges.js";
import type { Report } from "../report/report.js";

/** The rules behind the contributor badges, for the report's `thresholds.badges`. */
export const CONTRIBUTOR_BADGE_THRESHOLDS = {
  allRounderAreaShare: 0.5,
  allRounderMinAreas: 4,
  specialistShare: 0.8,
  cleanerNetDeletedLines: 500,
  founderShare: 0.25,
  testerShare: 0.4,
  documenterShare: 0.4,
  steadyMonths: 6,
  welcomeDays: NEW_CONTRIBUTOR_DAYS,
  returningGapDays: 183,
  reviewerReviews: 10,
};

export type ContributorBadgeFacts = {
  /** The scope's classified commits over the full history, newest first. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  readonly now: DateTime.Utc;
  /** The areas of the recommended level; they decide all-rounder, specialist and keeper. */
  readonly areas: ReadonlyArray<AreaWithFiles>;
  readonly isCodePath: (path: string) => boolean;
  readonly isTestPath: (path: string) => boolean;
  readonly isDocPath: (path: string) => boolean;
  /** Reviews the person did in the window; undefined without `--github`, which withholds `reviewer`. */
  readonly reviews: number | undefined;
};

/**
 * The badges the contributor earns, most important first. Positive or neutral
 * only, and none about working hours. `welcome` stands in for the "new" status
 * pill. Each carries its rule and the numbers behind it as evidence.
 */
export const contributorBadges = (
  contributor: Omit<Report["contributors"][number], "badges">,
  facts: ContributorBadgeFacts,
): ReadonlyArray<ContributorBadge> => {
  throw new Error(
    `not implemented: ${contributor.email} ${facts.areas.length}`,
  );
};

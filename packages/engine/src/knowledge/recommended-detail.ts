// Owns choosing the territory detail that suits the team: target territories from active contributors, then the closest detail.
// A pure function over counts, kept apart from the partition so the calibration constants live in one place.
// Cost: one comparison per detail.

import { TERRITORY_MIN_FILES } from "./territory-tree.js";

/** Contributors with a commit in this many days before now size the recommendation. */
export const RECOMMENDATION_ACTIVE_DAYS = 90;
/** The recommendation aims at this many territories per such contributor. */
export const TERRITORIES_PER_CONTRIBUTOR = 2;
/** The target number of territories is at least this many. */
export const MIN_TARGET_TERRITORIES = 4;
/** The target number of territories is at most this many. */
export const MAX_TARGET_TERRITORIES = 25;

export type DetailRecommendation = {
  /** The recommended detail, one of the details given. */
  readonly detail: number;
  /** The choice in words: "detail 2: 11 territories with 3+ files for 6 active contributors". */
  readonly reason: string;
};

export type DetailFacts = {
  /** Each detail with its count of viable territories: those that are not `other` territories. Ascending, never empty. */
  readonly details: ReadonlyArray<{
    readonly detail: number;
    readonly viableTerritories: number;
  }>;
  /** Contributors with a commit in the last `RECOMMENDATION_ACTIVE_DAYS` days. */
  readonly activeContributors: number;
  /** Contributors of the whole history; they size the target when nobody is active. */
  readonly historyContributors: number;
};

const counted = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * The detail whose count of viable territories is closest to the target: 2 territories per
 * active contributor (every contributor of the history when none is active), clamped
 * to 4..25. A tie goes to the coarser detail.
 */
export const recommendDetail = ({
  details,
  activeContributors,
  historyContributors,
}: DetailFacts): DetailRecommendation => {
  const anyActive = activeContributors > 0;
  const people = anyActive ? activeContributors : historyContributors;
  const target = clamp(
    people * TERRITORIES_PER_CONTRIBUTOR,
    MIN_TARGET_TERRITORIES,
    MAX_TARGET_TERRITORIES,
  );
  const distance = (detail: { readonly viableTerritories: number }): number =>
    Math.abs(detail.viableTerritories - target);
  const chosen = details.reduce((best, detail) =>
    distance(detail) < distance(best) ? detail : best,
  );
  const team = anyActive
    ? counted(people, "active contributor", "active contributors")
    : counted(people, "contributor", "contributors");
  return {
    detail: chosen.detail,
    reason: `detail ${chosen.detail}: ${counted(chosen.viableTerritories, "territory", "territories")} with ${TERRITORY_MIN_FILES}+ files for ${team}`,
  };
};

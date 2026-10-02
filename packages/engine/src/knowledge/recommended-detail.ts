// Owns choosing the territory detail that suits the team: as deep as expertise keeps changing, within what the team and the reader can take in.
// A pure function over counts, kept apart from the partition so the calibration constants live in one place.
// Cost: one comparison per detail.

/** Contributors with a commit in this many days before now size the recommendation. */
export const RECOMMENDATION_ACTIVE_DAYS = 90;
/** The recommendation allows this many territories per such contributor. */
export const TERRITORIES_PER_CONTRIBUTOR = 2;
/** The territories the recommendation allows are at least this many. */
export const MIN_TARGET_TERRITORIES = 4;
/** The territories the recommendation allows are at most this many, which is what a reader takes in at a glance. */
export const MAX_TARGET_TERRITORIES = 25;

export type DetailRecommendation = {
  /** The recommended detail, one of the details given. */
  readonly detail: number;
  /** The choice in words: "detail 2: 11 territories (without other files) for 6 active contributors". */
  readonly reason: string;
};

export type DetailFacts = {
  /** Each detail with its count of viable territories: those that are not `other` territories. Ascending from detail 1, never empty. */
  readonly details: ReadonlyArray<{
    readonly detail: number;
    readonly viableTerritories: number;
  }>;
  /** The last detail whose splits separate folders with different experts; 1 when none does. */
  readonly expertiseDetail: number;
  /** Contributors with a commit in the last `RECOMMENDATION_ACTIVE_DAYS` days. */
  readonly activeContributors: number;
  /** Contributors of the whole history; they size the allowance when nobody is active. */
  readonly historyContributors: number;
};

const counted = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * The deepest detail that stops at `expertiseDetail` and has no more viable
 * territories than the team allows: 2 per active contributor (every contributor
 * of the history when none is active), clamped to 4..25. A detail whose
 * predecessor still has fewer than 4 territories is allowed past `expertiseDetail`,
 * because a handful of cards says too little. Detail 1 is the fallback however
 * many territories it has.
 */
export const recommendDetail = ({
  details,
  expertiseDetail,
  activeContributors,
  historyContributors,
}: DetailFacts): DetailRecommendation => {
  const anyActive = activeContributors > 0;
  const people = anyActive ? activeContributors : historyContributors;
  const allowed = clamp(
    people * TERRITORIES_PER_CONTRIBUTOR,
    MIN_TARGET_TERRITORIES,
    MAX_TARGET_TERRITORIES,
  );
  const [coarsest, ...finer] = details;
  let chosen = coarsest ?? { detail: 1, viableTerritories: 0 };
  for (const detail of finer) {
    const stillCoarse = chosen.viableTerritories < MIN_TARGET_TERRITORIES;
    if (
      detail.viableTerritories > allowed ||
      (detail.detail > expertiseDetail && !stillCoarse)
    ) {
      break;
    }
    chosen = detail;
  }
  const team = anyActive
    ? counted(people, "active contributor", "active contributors")
    : counted(people, "contributor", "contributors");
  return {
    detail: chosen.detail,
    reason: `detail ${chosen.detail}: ${counted(chosen.viableTerritories, "territory", "territories")} (without other files) for ${team}`,
  };
};

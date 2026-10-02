// Owns choosing the area level that suits the team: target areas from active contributors, then the closest level.
// A pure function over counts, kept apart from the partition so the calibration constants live in one place.
// Cost: one comparison per level.

/** Contributors with a commit in this many days before now size the recommendation. */
export const RECOMMENDATION_ACTIVE_DAYS = 90;
/** The recommendation aims at this many areas per such contributor. */
export const AREAS_PER_CONTRIBUTOR = 2;
/** The target number of areas is at least this many. */
export const MIN_TARGET_AREAS = 4;
/** The target number of areas is at most this many. */
export const MAX_TARGET_AREAS = 25;

export type DepthRecommendation = {
  /** The recommended level, one of the levels given. */
  readonly depth: number;
  /** The choice in words: "level 2: 11 areas for 6 active contributors". */
  readonly reason: string;
};

export type DepthFacts = {
  /** Each level with its count of viable areas: those that are not `rest` areas. Ascending, never empty. */
  readonly levels: ReadonlyArray<{
    readonly depth: number;
    readonly viableAreas: number;
  }>;
  /** Contributors with a commit in the last `RECOMMENDATION_ACTIVE_DAYS` days. */
  readonly activeContributors: number;
  /** Contributors of the whole history; they size the target when nobody is active. */
  readonly historyContributors: number;
};

const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * The level whose count of viable areas is closest to the target: 2 areas per
 * active contributor (every contributor of the history when none is active), clamped
 * to 4..25. A tie goes to the coarser level.
 */
export const recommendDepth = ({
  levels,
  activeContributors,
  historyContributors,
}: DepthFacts): DepthRecommendation => {
  const anyActive = activeContributors > 0;
  const people = anyActive ? activeContributors : historyContributors;
  const target = clamp(
    people * AREAS_PER_CONTRIBUTOR,
    MIN_TARGET_AREAS,
    MAX_TARGET_AREAS,
  );
  const distance = (level: { readonly viableAreas: number }): number =>
    Math.abs(level.viableAreas - target);
  const chosen = levels.reduce((best, level) =>
    distance(level) < distance(best) ? level : best,
  );
  const team = plural(people, anyActive ? "active contributor" : "contributor");
  return {
    depth: chosen.depth,
    reason: `level ${chosen.depth}: ${plural(chosen.viableAreas, "area")} for ${team}`,
  };
};

// Owns who counts as an expert on one file: a person whose degree is close to the best.
// Reads contributions only, so bots and agents cannot appear.

import type { Contribution } from "./contributions.js";
import { degreeOfExpertise, EXPERT_RATIO } from "./doe.js";

const SECONDS_PER_DAY = 86_400;

/**
 * The emails of the people who are experts on a file of `size` non-blank
 * lines: at least 0.7 times the highest degree among the file's authors, and
 * at least one added line. `headTime` (seconds) is where recency is measured from.
 */
export const expertsOf = (
  contributions: ReadonlyArray<Contribution>,
  file: { readonly size: number; readonly headTime: number },
): ReadonlyArray<string> => {
  const degrees = contributions.map((contribution) => ({
    contribution,
    degree: degreeOfExpertise({
      adds: contribution.adds,
      firstAuthor: contribution.firstAuthor,
      days: Math.max(
        0,
        Math.floor((file.headTime - contribution.lastTime) / SECONDS_PER_DAY),
      ),
      size: file.size,
    }),
  }));
  const best = Math.max(...degrees.map(({ degree }) => degree));
  return degrees
    .filter(
      ({ contribution, degree }) =>
        contribution.adds > 0 && degree / best >= EXPERT_RATIO,
    )
    .map(({ contribution }) => contribution.email);
};

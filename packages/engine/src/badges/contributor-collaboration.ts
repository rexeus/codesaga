// Owns the collaboration badge that history can show: pair partner, from the co-author trailers of a person's commits.
// Apart from `contributor-badges.ts` because it reads the trailers' outcome that classification left on each commit.
// Cost: one pass over the contributor's commits.
import { isActiveWithin } from "../contributors/activeness.js";
import { countOf } from "../report/sentences.js";
import type { BadgeContext } from "./contributor-badge-facts.js";
import { CONTRIBUTOR_BADGE_THRESHOLDS } from "./contributor-badge-thresholds.js";

const { recentWindowDays, pairPartnerCommits } = CONTRIBUTOR_BADGE_THRESHOLDS;

/**
 * At least `pairPartnerCommits` commits of the last `recentWindowDays` days
 * with a `Co-authored-by` trailer that names another person, not an agent or
 * a bot. Trailers are inconsistent, so their absence says nothing.
 */
export const pairPartner = ({ commits, now }: BadgeContext) => {
  const paired = commits.filter(
    ({ time, humanCoAuthors }) =>
      humanCoAuthors > 0 && isActiveWithin(time, now, recentWindowDays),
  ).length;
  return paired >= pairPartnerCommits
    ? {
        kind: "pair-partner" as const,
        label: "Pair partner",
        evidence: `${countOf(paired)} commits in the last year with another person as co-author.`,
      }
    : undefined;
};

// Owns which category a contributor badge belongs to and the order the categories appear in.
// Apart from the rules because the category follows from the kind alone and reads no facts.
import type { ContributorBadge } from "../report/badges.js";

const CATEGORY_OF: Record<
  ContributorBadge["kind"],
  ContributorBadge["category"]
> = {
  "all-rounder": "focus",
  specialist: "focus",
  keeper: "focus",
  tidier: "craft",
  tester: "craft",
  documenter: "craft",
  founder: "journey",
  steady: "journey",
  "new-here": "journey",
  "back-again": "journey",
  "night-owl": "rhythm",
  "early-bird": "rhythm",
  "weekend-regular": "rhythm",
  reviewer: "collaboration",
};

/** The order a person's badges appear in: the card shows the first three, so the order is by category and never by importance. */
const CATEGORY_ORDER: ReadonlyArray<ContributorBadge["category"]> = [
  "focus",
  "craft",
  "rhythm",
  "collaboration",
  "journey",
];

/** A badge a rule earned, before its category is filed. */
export type EarnedContributorBadge = Omit<ContributorBadge, "category">;

/**
 * The badges with the category of their kind, ordered by category and, within
 * a category, in the order the rules produced them.
 */
export const categorized = (
  badges: ReadonlyArray<EarnedContributorBadge>,
): ReadonlyArray<ContributorBadge> =>
  badges
    .map((badge) => ({ ...badge, category: CATEGORY_OF[badge.kind] }))
    .toSorted(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
    );

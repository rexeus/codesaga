// Owns which category a territory badge belongs to: knowledge, code or activity.
// Apart from the rules because the category follows from the kind alone and reads no facts.
import type { TerritoryBadge } from "../report/badges.js";

const CATEGORY_OF: Record<TerritoryBadge["kind"], TerritoryBadge["category"]> =
  {
    island: "knowledge",
    orphaned: "knowledge",
    "one-expert": "knowledge",
    "shared-knowledge": "knowledge",
    "knowledge-fading": "knowledge",
    handover: "knowledge",
    "newcomer-friendly": "knowledge",
    "new-territory": "activity",
    "in-focus": "activity",
    quiet: "activity",
    "well-tested": "code",
  };

/** A badge a rule earned, before its category is filed. */
export type EarnedBadge = Omit<TerritoryBadge, "category">;

/** The badge with the category of its kind, as the report carries it. */
export const withCategory = (badge: EarnedBadge): TerritoryBadge => ({
  ...badge,
  category: CATEGORY_OF[badge.kind],
});

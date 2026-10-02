// Owns the badges of one contributor: which positive or neutral achievements their commits earn, grouped by category.
// Apart from the contributors section because the rules need the territories, the full history and the files each person founded.
// The rule families live in `contributor-*.ts`; this module only puts them in order.

import type { ContributorBadge } from "../report/badges.js";
import { categorized } from "./contributor-badge-category.js";
import type { EarnedContributorBadge } from "./contributor-badge-category.js";
import type {
  BadgeContext,
  ContributorBadgeFacts,
} from "./contributor-badge-facts.js";
import { codeCraftBadges } from "./contributor-code-craft.js";
import { pairPartner } from "./contributor-collaboration.js";
import { documenter, tester, tidier, toolsmith } from "./contributor-craft.js";
import { allRounder, keeper, specialist } from "./contributor-focus.js";
import { explorer, founder, longHauler } from "./contributor-journey.js";
import { rhythmBadges } from "./contributor-rhythm.js";
import { tenureBadges } from "./contributor-tenure.js";

/** In the order the rules of a category appear in a person's badges. */
const RULES: ReadonlyArray<
  (context: BadgeContext) => EarnedContributorBadge | undefined
> = [
  allRounder,
  specialist,
  keeper,
  tidier,
  tester,
  documenter,
  toolsmith,
  pairPartner,
  founder,
  longHauler,
  explorer,
];

/**
 * The badges the contributor earns, ordered by category (focus, craft, rhythm,
 * collaboration, journey) and by rule within a category. Positive or neutral
 * only, and none compares people. `new-here` stands in for the "new" status
 * pill. Each carries its rule and the numbers behind it as evidence.
 * `reviewer` is never awarded: GitHub reviews are not tied to identities yet.
 * Without `facts.territories` the four badges that need territories are
 * withheld; in a repository with one contributor over the full history
 * `all-rounder` and `keeper` are too, since they would compare the person with
 * nobody. In a shallow clone, where `facts.repositoryStart` is undefined,
 * `new-here`, `long-hauler` and `explorer` are withheld.
 */
export const contributorBadges = (
  email: string,
  facts: ContributorBadgeFacts,
): ReadonlyArray<ContributorBadge> => {
  if (facts.commits.length === 0) {
    return [];
  }
  const context = { ...facts, email };
  return categorized([
    ...RULES.flatMap((rule) => rule(context) ?? []),
    ...codeCraftBadges(context),
    ...rhythmBadges(facts.commits, facts.now, facts.historyHasOtherOffsets),
    ...tenureBadges(facts.commits, facts.repositoryStart, facts.now),
  ]);
};

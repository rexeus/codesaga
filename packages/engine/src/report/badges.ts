// Owns the badge schemas of the report: the badges of a territory and of a contributor.
// Both share one shape and differ in their kinds, so a consumer picks the icon from `kind` and the text from `label`.
// A new kind is an additive change; renaming or removing one bumps the schema version.
import { Schema } from "effect";

/**
 * A badge of a territory. Never comparative: each badge states a fact about the
 * territory and the rule that produced it.
 */
export const TerritoryBadge = Schema.Struct({
  /**
   * `island`: one person is the sole expert on at least `thresholds.islandShare`
   * of the files. `orphaned`: more than `thresholds.orphanedShare` of the files
   * have no active expert. `one-expert`: exactly one person is an active expert of the territory.
   * `shared-knowledge`: at least `thresholds.badges.sharedActiveExperts` active
   * experts and a truck factor of at least `thresholds.badges.sharedTruckFactor`.
   * `knowledge-fading`: the main expert has been silent for
   * `thresholds.badges.fadingFromDays` to `fadingToDays` days. `handover`: the
   * previous main expert (the dormant expert on the most files) is replaced by
   * an active main expert whose first commit to the territory is at most
   * `thresholds.badges.handoverDays` days old. `newcomer-friendly`: at least
   * `thresholds.badges.newcomerFriendlyFirstCommits` people made their first
   * commit here in the last `newcomerFriendlyDays` days. `new-territory`: the
   * territory's first commit is at most `thresholds.badges.newTerritoryDays`
   * days old and at least `thresholds.badges.newTerritoryAfterStartDays` days
   * after the repository's first commit, so the territories of a young
   * repository are not new one by one. `in-focus`: the territory with the most
   * human and agent-assisted commits in the last `thresholds.badges.inFocusDays`
   * days, whatever the window of the analysis. `quiet`: unchanged for at least
   * `thresholds.badges.quietDays` days. `heavyweight`: at least
   * `thresholds.badges.heavyweightShare` of the repository's code lines, or a
   * median file of at least `heavyweightMedianFileLines` lines. `hotspot`: at
   * least `thresholds.badges.hotspotShare` of the repository's revisions times
   * lines (`stats.churn.revisionLines`), after codeheat's churn times size.
   * Both also need `codeBadgeMinSiblings` named territories at the territory's
   * level of the tree, itself included, and a share of their code lines
   * (`heavyweight`) or revisions times lines (`hotspot`) of at least
   * `codeBadgeFairShareFactor` times the fair share, one over their number, so
   * a small cut does not badge everything. `churning`: the median
   * file was revised at least `churningRatio` times as often as the
   * repository's and at least `churningMinRevisions` times. `deeply-nested`:
   * at least `nestedRatio` times the repository's indentation levels per line
   * and at least `nestedMinLevels`. Both also need `codeBadgeMinSiblings` named
   * territories at the territory's level and a value of at least
   * `codeBadgeMedianFactor` times the median of those territories' values. `well-tested`: at least
   * `thresholds.badges.wellTestedShare` of the files are tests; never awarded to
   * a territory whose own path is inside a test directory.
   */
  kind: Schema.Literals([
    "island",
    "orphaned",
    "one-expert",
    "shared-knowledge",
    "knowledge-fading",
    "handover",
    "newcomer-friendly",
    "new-territory",
    "in-focus",
    "quiet",
    "heavyweight",
    "hotspot",
    "churning",
    "deeply-nested",
    "well-tested",
  ]),
  /**
   * What the badge is about: `knowledge` (`island`, `orphaned`, `one-expert`,
   * `shared-knowledge`, `knowledge-fading`, `handover`, `newcomer-friendly`),
   * `activity` (`new-territory`, `in-focus`, `quiet`) or `code` (`heavyweight`, `hotspot`, `churning`, `deeply-nested`, `well-tested`).
   * Determined by `kind`.
   */
  category: Schema.Literals(["knowledge", "code", "activity"]),
  /** Short text for the badge itself, such as "Knowledge island". */
  label: Schema.String,
  /** The rule and the numbers behind the badge, for a tooltip: "One person is sole expert on 41 of 48 files." */
  evidence: Schema.String,
});
export type TerritoryBadge = typeof TerritoryBadge.Type;

/**
 * A badge of a contributor: positive or neutral, and never comparative. It
 * describes what the person's commits show and never ranks them. Reviewing
 * needs `--github`.
 */
export const ContributorBadge = Schema.Struct({
  /**
   * `all-rounder`: commits in at least `thresholds.badges.allRounderTerritoryShare`
   * of the territories, and in at least `allRounderMinTerritories`; never awarded when
   * the full history has a single contributor. `specialist`: at least
   * `specialistShare` of the commits fall into one territory. `tidier`: net
   * deletions of at least `tidierNetDeletedLines` code lines. `founder`: first
   * author of at least `founderShare` of today's files. `keeper`: the only
   * active expert of a territory; never awarded when the full history has a single
   * contributor. `tester`: at least `testerShare` of the changed
   * files are tests. `documenter`: at least `documenterShare` of the commits
   * touch documentation. `steady`: a commit in each of the last
   * `steadyMonths` months. `new-here`: the first commit lies at most
   * `newHereDays` days back. `back-again`: active again after a pause of at
   * least `backAgainGapDays` days. `reviewer`: at least `reviewerReviews`
   * reviews; only with `--github`.
   */
  kind: Schema.Literals([
    "all-rounder",
    "specialist",
    "tidier",
    "founder",
    "keeper",
    "tester",
    "documenter",
    "steady",
    "new-here",
    "back-again",
    "reviewer",
  ]),
  /**
   * What the badge is about: `focus` (`all-rounder`, `specialist`, `keeper`),
   * `craft` (`tidier`, `tester`, `documenter`), `rhythm`, `collaboration`
   * (`reviewer`) or `journey` (`founder`, `steady`, `new-here`, `back-again`).
   * Determined by `kind`. A person's badges are ordered by category in that order.
   */
  category: Schema.Literals([
    "focus",
    "craft",
    "rhythm",
    "collaboration",
    "journey",
  ]),
  /** Short text for the badge itself, such as "engine specialist". */
  label: Schema.String,
  /** The rule and the numbers behind the badge, for a tooltip. */
  evidence: Schema.String,
});
export type ContributorBadge = typeof ContributorBadge.Type;

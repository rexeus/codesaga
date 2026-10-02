// Owns the badge schemas of the report: the achievements of an area and of a contributor.
// Both share one shape and differ in their kinds, so a consumer picks the icon from `kind` and the text from `label`.
// A new kind is an additive change; renaming or removing one bumps the schema version.
import { Schema } from "effect";

/**
 * An achievement of a knowledge area. Never comparative: each badge states a
 * fact about the area and the rule that produced it.
 */
export const AreaBadge = Schema.Struct({
  /**
   * `island`: one person is the sole expert on at least `thresholds.islandShare`
   * of the files. `orphaned`: more than `thresholds.orphanedShare` of the files
   * have no active expert. `single-expert`: exactly one person is an active expert of the area.
   * `shared-knowledge`: at least `thresholds.badges.sharedActiveExperts` active
   * experts and a truck factor of at least `thresholds.badges.sharedTruckFactor`.
   * `knowledge-fading`: the main expert has been silent for
   * `thresholds.badges.fadingFromDays` to `fadingToDays` days. `handover`: the
   * previous main expert (the dormant expert on the most files) is replaced by
   * an active main expert whose first commit to the area is at most
   * `thresholds.badges.handoverDays` days old. `new`: the area's first commit
   * is at most `thresholds.badges.newDays` days old and at least
   * `thresholds.badges.newAfterStartDays` days after the repository's first
   * commit, so the areas of a young repository are not new one by one. `in-focus`: the
   * area with the most commits in the window. `quiet`: unchanged for at least
   * `thresholds.badges.quietDays` days. `newcomer-friendly`: at least
   * `thresholds.badges.newcomerFriendlyFirstCommits` people made their first
   * commit here in the last `newcomerFriendlyDays` days. `well-tested`: at
   * least `thresholds.badges.wellTestedShare` of the files are tests.
   */
  kind: Schema.Literals([
    "island",
    "orphaned",
    "single-expert",
    "shared-knowledge",
    "knowledge-fading",
    "handover",
    "new",
    "in-focus",
    "quiet",
    "newcomer-friendly",
    "well-tested",
  ]),
  /** Short text for the badge itself, such as "Knowledge island". */
  label: Schema.String,
  /** The rule and the numbers behind the badge, for a tooltip: "One person is sole expert on 41 of 48 files." */
  evidence: Schema.String,
});
export type AreaBadge = typeof AreaBadge.Type;

/**
 * An achievement of a contributor: positive or neutral, never comparative, and
 * never about working hours. Reviewing needs `--github`.
 */
export const ContributorBadge = Schema.Struct({
  /**
   * `all-rounder`: commits in at least `thresholds.badges.allRounderAreaShare`
   * of the areas, and in at least `allRounderMinAreas`. `specialist`: at least
   * `specialistShare` of the commits fall into one area. `cleaner`: net
   * deletions of at least `cleanerNetDeletedLines` code lines. `founder`: first
   * author of at least `founderShare` of today's files. `keeper`: the only
   * active expert of an area. `tester`: at least `testerShare` of the changed
   * files are tests. `documenter`: at least `documenterShare` of the commits
   * touch documentation. `steady`: a commit in each of the last
   * `steadyMonths` months. `welcome`: the first commit lies at most
   * `welcomeDays` days back. `returning`: active again after a pause of at
   * least `returningGapDays` days. `reviewer`: at least `reviewerReviews`
   * reviews; only with `--github`.
   */
  kind: Schema.Literals([
    "all-rounder",
    "specialist",
    "cleaner",
    "founder",
    "keeper",
    "tester",
    "documenter",
    "steady",
    "welcome",
    "returning",
    "reviewer",
  ]),
  /** Short text for the badge itself, such as "Specialist: engine". */
  label: Schema.String,
  /** The rule and the numbers behind the badge, for a tooltip. */
  evidence: Schema.String,
});
export type ContributorBadge = typeof ContributorBadge.Type;

// Owns the thresholds schema of the report: every constant an analysis applied, so consumers see the rules.
// Rules for areas and badges nest under their own key; the first five fields predate them and stay flat.
import { Schema } from "effect";

const Count = Schema.Natural;
const Share = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }));

/** How the knowledge areas are cut and how deep the dashboard starts. */
const AreaThresholds = Schema.Struct({
  /** An area with fewer universe files is grouped with its siblings as "other files". */
  minFiles: Count,
  /** The deepest level reported. */
  maxDepth: Count,
  /** Contributors with a commit in this many days before now size the recommendation. */
  recommendationActiveDays: Count,
  /** The recommended depth aims at this many areas per such contributor. */
  areasPerContributor: Count,
  /** The target number of areas is clamped to at least this many. */
  minTargetAreas: Count,
  /** The target number of areas is clamped to at most this many. */
  maxTargetAreas: Count,
});

/** The rules behind the badges of areas and contributors; the meaning of each is on its badge kind. */
const BadgeThresholds = Schema.Struct({
  sharedActiveExperts: Count,
  sharedTruckFactor: Count,
  fadingFromDays: Count,
  fadingToDays: Count,
  newDays: Count,
  quietDays: Count,
  newcomerFriendlyFirstCommits: Count,
  newcomerFriendlyDays: Count,
  wellTestedShare: Share,
  allRounderAreaShare: Share,
  allRounderMinAreas: Count,
  specialistShare: Share,
  cleanerNetDeletedLines: Count,
  founderShare: Share,
  testerShare: Share,
  documenterShare: Share,
  steadyMonths: Count,
  welcomeDays: Count,
  returningGapDays: Count,
  reviewerReviews: Count,
});

/** The constants an analysis applied, reported so consumers see them. */
export const Thresholds = Schema.Struct({
  /** A contributor is active with a commit in this many days before now. */
  activeDays: Count,
  /** An expert's Degree of Expertise is at least this share of the highest among the file's authors. */
  expertRatio: Schema.Finite,
  /** A directory is reported when its subtree holds at least this many universe files. */
  minDirectoryFiles: Count,
  /** A directory is a knowledge island when one person is the sole expert on at least this share of its files. */
  islandShare: Schema.Finite,
  /** A directory is orphaned when more than this share of its files have no active expert. */
  orphanedShare: Schema.Finite,
  areas: AreaThresholds,
  badges: BadgeThresholds,
});

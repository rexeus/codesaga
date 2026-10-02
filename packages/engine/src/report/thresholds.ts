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
  /** An area with more than this share of the universe files, and subdirectories, is split further within its level. */
  giantShare: Share,
  /** A giant area is split at most this many directory steps beyond its level. */
  giantSplitSteps: Count,
  /** Contributors with a commit in this many days before now size the recommendation. */
  recommendationActiveDays: Count,
  /** The recommended depth aims at this many areas per such contributor. */
  areasPerContributor: Count,
  /** The target number of areas is clamped to at least this many. */
  minTargetAreas: Count,
  /** The target number of areas is clamped to at most this many. */
  maxTargetAreas: Count,
});

/** The rules behind the highlights; the meaning of each is on its highlight kind. */
const HighlightThresholds = Schema.Struct({
  /** `streak` shows when the longest run of days with a commit is at least this long. */
  streakMinDays: Count,
  /** `busiest-day` shows when the day has at least this many commits. */
  busiestDayMinCommits: Count,
  /** `night-owls` and `weekend` need at least this many human commits to say anything about a share. */
  rhythmMinCommits: Count,
  /** `night-owls` shows when at least this share of the human commits falls into the night hours. */
  nightOwlShare: Share,
  /** The night starts at this local hour (0 to 23) ... */
  nightFromHour: Count,
  /** ... and ends before this one. */
  nightToHour: Count,
  /** `weekend` shows when at least this share of the human commits lands on a Saturday or Sunday. */
  weekendShare: Share,
  /** `quiet-area` shows when the area has not changed for at least this many calendar months. */
  quietAreaMonths: Count,
  /** `newcomers` shows when at least this many people made their first commit in `newcomerDays`. */
  newcomersMinPeople: Count,
  /** A newcomer made the first commit at most this many days ago. */
  newcomerDays: Count,
  /** `anniversary` shows when the first commit's anniversary is at most this many days from now. */
  anniversaryWindowDays: Count,
  /** `biggest-cleanup` shows when one commit deleted this many more code lines than it added. */
  cleanupMinNetDeletedLines: Count,
  /** `rename-record` shows when a file was renamed at least this often. */
  renameRecordMinRenames: Count,
});

/** The rules behind the badges of areas and contributors; the meaning of each is on its badge kind. */
const BadgeThresholds = Schema.Struct({
  sharedActiveExperts: Count,
  sharedTruckFactor: Count,
  fadingFromDays: Count,
  fadingToDays: Count,
  newDays: Count,
  /** An area is `new` only when its first commit is at least this many days after the repository's first. */
  newAfterStartDays: Count,
  /** `handover` needs the new main expert's first commit to the area at most this many days ago. */
  handoverDays: Count,
  /** `in-focus` counts the commits of the last this many days. */
  inFocusDays: Count,
  quietDays: Count,
  newcomerFriendlyFirstCommits: Count,
  newcomerFriendlyDays: Count,
  wellTestedShare: Share,
  /** `specialist`, `tester` and `documenter` need at least this many commits to say anything about a share. */
  minCommitsForShare: Count,
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
  /** An expert, and the `active` flag of a contributor, need a commit in this many days before now. */
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
  highlights: HighlightThresholds,
  badges: BadgeThresholds,
});

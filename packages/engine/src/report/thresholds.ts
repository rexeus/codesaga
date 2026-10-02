// Owns the thresholds schema of the report: every constant an analysis applied, so consumers see the rules.
// Rules for territories and badges nest under their own key; the first five fields predate them and stay flat.
import { Schema } from "effect";

const Count = Schema.Natural;
const Share = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }));

/** How the knowledge territories are cut and how deep the dashboard starts. */
const TerritoryThresholds = Schema.Struct({
  /** A territory with fewer universe files is grouped with its siblings as "other files". */
  minFiles: Count,
  /** The finest detail reported. */
  maxDetail: Count,
  /** A territory with more than this share of the universe files is big and splits into its folders ... */
  bigShare: Share,
  /** ... as does one with more files than this share of them, though at least `bigMinFiles` and at most `bigMaxFiles`. */
  bigFilesShare: Share,
  /** The size at which a territory is big is at least this many files ... */
  bigMinFiles: Count,
  /** ... and at most this many. */
  bigMaxFiles: Count,
  /** A territory also splits when its folders have different main experts; a main expert is an expert on at least this share of the folder's files that have an expert. */
  mainExpertShare: Share,
  /** Contributors with a commit in this many days before now size the recommendation. */
  recommendationActiveDays: Count,
  /** The recommended detail allows this many territories per such contributor. */
  territoriesPerContributor: Count,
  /** The territories the recommended detail allows are at least this many ... */
  minTargetTerritories: Count,
  /** ... and at most this many. */
  maxTargetTerritories: Count,
});

/** The rules behind the stories; the meaning of each is on its story kind. */
const StoryThresholds = Schema.Struct({
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
  /** `quiet-territory` shows when the territory has not changed for at least this many calendar months. */
  quietTerritoryMonths: Count,
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

/** The rules behind the badges of territories and contributors; the meaning of each is on its badge kind. */
const BadgeThresholds = Schema.Struct({
  sharedActiveExperts: Count,
  sharedTruckFactor: Count,
  fadingFromDays: Count,
  fadingToDays: Count,
  newTerritoryDays: Count,
  /** A territory is `new-territory` only when its first commit is at least this many days after the repository's first. */
  newTerritoryAfterStartDays: Count,
  /** `handover` needs the new main expert's first commit to the territory at most this many days ago. */
  handoverDays: Count,
  /** `in-focus` counts the commits of the last this many days. */
  inFocusDays: Count,
  quietDays: Count,
  newcomerFriendlyFirstCommits: Count,
  newcomerFriendlyDays: Count,
  wellTestedShare: Share,
  /** `heavyweight`, `hotspot`, `churning` and `deeply-nested` need at least this many named territories at the territory's level of the tree, itself included. */
  codeBadgeMinSiblings: Count,
  /** `heavyweight` and `hotspot` need a share among those territories of at least this many times the fair share, one over their number. */
  codeBadgeFairShareFactor: Schema.Finite,
  /** `churning` and `deeply-nested` need a value of at least this many times the median of those territories. */
  codeBadgeMedianFactor: Schema.Finite,
  /** `heavyweight` needs at least this share of the repository's code lines ... */
  heavyweightShare: Share,
  /** ... or a median file of at least this many lines. */
  heavyweightMedianFileLines: Count,
  /** `hotspot` needs at least this share of the repository's revisions times lines. */
  hotspotShare: Share,
  /** `churning` needs a median file revised at least this many times the repository's median ... */
  churningRatio: Schema.Finite,
  /** ... and at least this many times. */
  churningMinRevisions: Count,
  /** `deeply-nested` needs at least this many times the repository's indentation levels per line ... */
  nestedRatio: Schema.Finite,
  /** ... and at least this many levels per line. */
  nestedMinLevels: Schema.Finite,
  /** `specialist`, `tester` and `documenter` need at least this many commits to say anything about a share. */
  minCommitsForShare: Count,
  allRounderTerritoryShare: Share,
  allRounderMinTerritories: Count,
  specialistShare: Share,
  tidierNetDeletedLines: Count,
  founderShare: Share,
  testerShare: Share,
  documenterShare: Share,
  steadyMonths: Count,
  newHereDays: Count,
  backAgainGapDays: Count,
  reviewerReviews: Count,
});

/** The rules behind the achievements; the meaning of each is on its achievement kind. */
const AchievementThresholds = Schema.Struct({
  /** `first-commits` tiers: commits. */
  firstCommitsTiers: Schema.Array(Count),
  /** `marathon` needs this many days between the first and the last commit. */
  marathonDays: Count,
  /** `community` tiers: contributors over the full history. */
  communityTiers: Schema.Array(Count),
  /** `bus-proof` needs a truck factor of at least this. */
  busProofTruckFactor: Count,
  /** `polyglot` needs this many languages ... */
  polyglotLanguages: Count,
  /** ... each with at least this share of the code lines. */
  polyglotMinShare: Share,
  /** `test-culture` needs at least this share of the files to be tests. */
  testCultureShare: Share,
  /** `unbroken` needs a commit on this many consecutive days. */
  unbrokenDays: Count,
  /** `spring-cleaning` needs one commit that removed this many more code lines than it added. */
  springCleaningNetLines: Count,
  /** `fresh-blood` needs this many people ... */
  freshBloodPeople: Count,
  /** ... whose first commit lies at most this many days ago. */
  freshBloodDays: Count,
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
  territories: TerritoryThresholds,
  stories: StoryThresholds,
  badges: BadgeThresholds,
  achievements: AchievementThresholds,
});

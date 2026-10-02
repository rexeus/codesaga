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
  /** `night-owl`, `early-bird` and `weekend-regular` read the human commits of the last this many days ... */
  rhythmWindowDays: Count,
  /** ... need at least this many of them ... */
  rhythmMinCommits: Count,
  /** ... in at least this many calendar months ... */
  rhythmMinMonths: Count,
  /** ... and at least this share of them in the hours or on the days of the badge. */
  rhythmShare: Share,
  /** `night-owl` counts the hours from this one on, until `rhythmNightToHour` the next morning ... */
  rhythmNightFromHour: Count,
  /** ... and `early-bird` the hours from here until `rhythmEarlyToHour`. */
  rhythmNightToHour: Count,
  rhythmEarlyToHour: Count,
  /** The rhythm badges are withheld when at least this share of a person's commits carry +00:00 while the history has other offsets. */
  rhythmUtcShare: Share,
  /** `pair-partner` and `toolsmith` read the commits of the last this many days. */
  recentWindowDays: Count,
  /** `pair-partner` needs this many commits with a human co-author. */
  pairPartnerCommits: Count,
  /** `long-hauler` needs a first commit at least this many years ago ... */
  longHaulerYears: Count,
  /** ... and a commit in each of this many last quarters. */
  longHaulerQuarters: Count,
  /** `explorer` counts first commits in territories within this many days ... */
  explorerDays: Count,
  /** ... in at least this many territories. */
  explorerMinTerritories: Count,
  /** `toolsmith` needs this share of the commits to change only tooling files ... */
  toolsmithShare: Share,
  /** ... out of at least this many commits that change files. */
  toolsmithMinCommits: Count,
  /** The craft badges that read code facts compare the commits of the last `recentWindowDays` days and skip a commit that changes more files than this. */
  craftMaxFilesPerCommit: Count,
  /** `type-tightener` needs this many explicit `any` net removed ... */
  typeTightenerRemovedAny: Count,
  /** ... in at least this many commits that each net-remove one. */
  typeTightenerMinCommits: Count,
  /** `sweeper` needs this many declarations net removed. */
  sweeperRemovedDeclarations: Count,
  /** `simplifier` needs this many functions made simpler ... */
  simplifierFunctions: Count,
  /** ... each by at least this many points of cognitive complexity. */
  simplifierMinDrop: Count,
  /** `test-companion` needs this many commits that add an exported function to production code ... */
  testCompanionCommits: Count,
  /** ... and this share of them also adding test cases. */
  testCompanionShare: Share,
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

/**
 * The bands and limits of the TypeScript deep dive. They are named bands from
 * cited sources for reading a distribution, not targets: 15 is the default
 * limit of Sonar's cognitive-complexity rule, the length and parameter bands
 * follow the Software Improvement Group's guidance.
 */
const TypeScriptThresholds = Schema.Struct({
  /** The complexity bands `0–4`, `5–9`, `10–14`, `15–24` and `25+`, as the first value of each band after the first. */
  complexityBands: Schema.Array(Count),
  /** The per-function limit of cognitive complexity (Sonar's default); `over15` counts functions at or above it. */
  complexityLimit: Count,
  /** The length bands `1–15`, `16–30`, `31–60` and `61+` non-blank lines, as the first value of each band after the first. */
  lengthBands: Schema.Array(Count),
  /** A function has a long parameter list with more parameters than this. */
  maxParameters: Count,
  /** The assertion bands `0`, `1`, `2–3` and `4+` per test case, as the first value of each band after the first. */
  assertionBands: Schema.Array(Count),
  /** A file is a complexity hotspot at or above this quantile of the hardest-function scores and of the revisions among the production files with a function ... */
  hotspotQuantile: Share,
  /** ... with a hardest function of at least this score ... */
  hotspotMinComplexity: Count,
  /** ... and at least this many revisions. */
  hotspotMinRevisions: Count,
  /** A source over this many characters is not parsed (`too-large`). */
  maxSourceCharacters: Count,
  /** A source whose non-blank lines average more characters than this is minified and not parsed. */
  minifiedMeanLineLength: Count,
  /** The import structure's rules. */
  imports: Schema.Struct({
    /** `towardLessStable` lists an import edge toward a territory whose instability is at least this much higher. */
    instabilityGap: Schema.Finite,
    /** It needs both territories to have at least this many import edges in and out together. */
    minEdges: Count,
  }),
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
  /** The bands and limits of the TypeScript deep dive; always reported, whether or not the repository has TypeScript. */
  typescript: Schema.optionalKey(TypeScriptThresholds),
});

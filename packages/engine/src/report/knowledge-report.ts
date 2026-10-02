// Owns the report's knowledge section: experts, truck factor, islands, orphaned directories and line owners.
// `Report` embeds it and `InspectResult` reuses its pieces, so both describe people alike.
import { Schema } from "effect";

import { AreaBadge } from "./badges.js";

const Count = Schema.Natural;

/** Who wrote the lines of a set of files, according to `git blame`. */
export const LineOwners = Schema.Struct({
  /** Non-blank lines at HEAD that blame attributed, to anyone. */
  lines: Schema.Natural,
  /** Files of the set whose `git blame` failed for a reason other than being absent from HEAD; their lines are not in `lines`. */
  skippedFiles: Schema.Natural,
  /** The five authors with the most lines, most lines first. */
  owners: Schema.Array(
    Schema.Struct({
      /** Most recent name used with the email in the history; the name blame printed for an email the history lacks. */
      name: Schema.String,
      /** Mailmap-normalized, lowercased; the identity. */
      email: Schema.String,
      /** Lines the author wrote that still stand. */
      lines: Schema.Natural,
      /** `lines` divided by the set's `lines`, rounded to 4 decimals. */
      share: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
      /** What the author account is. Lines count for agents and bots too, marked here. */
      kind: Schema.Literals(["human", "agent", "bot"]),
    }),
  ).check(Schema.isMaxLength(5)),
});

/** A human the knowledge model found as an expert, with the state of their involvement. */
const Person = Schema.Struct({
  /** Most recent name used with the email. */
  name: Schema.String,
  /** Mailmap-normalized, lowercased; the identity. */
  email: Schema.String,
  /** A commit in the `thresholds.activeDays` days before now, over the full history. */
  active: Schema.Boolean,
  /** ISO timestamp of the person's last commit over the full history. */
  lastCommitAt: Schema.String,
});

/** A person's expertise over the files of one directory or inspected path set. */
export const Expert = Schema.Struct({
  ...Person.fields,
  /** Files the person is an expert on. */
  files: Count,
  /** Files on which the person is the only expert. */
  soleFiles: Count,
  /** `files` divided by the set's files, rounded to 4 decimals. */
  share: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
});

/** The knowledge state of one directory's subtree. */
const DirectoryKnowledge = Schema.Struct({
  /** Repository-relative directory. */
  path: Schema.String,
  /** Universe files in the subtree. */
  files: Count,
  /** People who must leave before more than half of the files have no expert. */
  truckFactor: Count,
  /** One person is the sole expert on at least `thresholds.islandShare` of the files. */
  island: Schema.Boolean,
  /** More than `thresholds.orphanedShare` of the files have no active expert. */
  orphaned: Schema.Boolean,
  /** The five people expert on the most files, most files first. */
  experts: Schema.Array(Expert).check(Schema.isMaxLength(5)),
  /** Plain-language explanations of the flags; empty for a directory with neither. */
  reasons: Schema.Array(Schema.String),
  /** Present only when the analysis ran with `blame`. Unlike `experts`, bots and agents own lines too. */
  lineOwners: Schema.optionalKey(LineOwners),
});

/**
 * The knowledge state of one area: a part of the repository that, together with
 * its siblings at the same level, covers every universe file exactly once.
 * Reads like a directory, so every field of `DirectoryKnowledge` applies to
 * the files of the area alone.
 */
const AreaKnowledge = Schema.Struct({
  ...DirectoryKnowledge.fields,
  /**
   * `package`: the root of a package, marked by a manifest such as
   * `package.json`; `directory`: a directory below a package root or below the
   * scope, or the scoped file itself when `analyze` is given a file; `rest`: the small areas below `path` grouped as "other files". For
   * `rest`, `path` is the directory that holds them, so a `package` area and
   * its `rest` area share a path: `path` and `kind` together identify an area.
   * A `rest` area with fewer than `thresholds.areas.minFiles` files is a
   * leftover: `island` and `orphaned` do not apply to it, so they are false and
   * `reasons` is empty.
   */
  kind: Schema.Literals(["package", "directory", "rest"]),
  /** Achievements of the area, most important first; the dashboard shows the first three. */
  badges: Schema.Array(AreaBadge),
});
export type AreaKnowledge = typeof AreaKnowledge.Type;

/** The areas of one level of depth. */
const AreaLevel = Schema.Struct({
  /**
   * 1 for packages (or top-level directories without packages), each further
   * level one directory step deeper. An area that holds more than
   * `thresholds.areas.giantShare` of the files is split further within its
   * level, so that one package does not become one card.
   */
  depth: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /** The areas of the level before the output limit cut `areas`. */
  totalAreas: Count,
  /** Ordered like `directories`: riskiest first, `rest` areas last. Possibly truncated by the output limit, per level; see `totalAreas`. */
  areas: Schema.Array(AreaKnowledge),
});
export type AreaLevel = typeof AreaLevel.Type;

/**
 * The knowledge in non-overlapping areas at several levels of depth, all
 * computed by the engine so that viewers only pick a level.
 */
const Areas = Schema.Struct({
  /** The level the terminal and the dashboard start at: `--depth`, else `recommendedDepth`. A `--depth` beyond the deepest level is the deepest level. */
  depth: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /** The level that suits the team size, chosen with `thresholds.areas`. */
  recommendedDepth: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /**
   * The recommendation in words: "level 2: 11 areas with 3+ files for 6 active
   * contributors". It counts the areas that are not `rest` groups, so the
   * level's `totalAreas` is higher.
   */
  reason: Schema.String,
  /** Levels 1 to the deepest useful one (at most `thresholds.areas.maxDepth`), in order; no two levels have the same areas. */
  levels: Schema.NonEmptyArray(AreaLevel),
});

/**
 * Who knows the code and whether they are still around. Covers the whole
 * history and the universe files of the scope, independent of `window` except for the `in-focus` area badge. Only
 * humans are experts: a file changed only by bots and agents has no expert.
 * Expertise is an estimate from history, not a fact.
 */
export const Knowledge = Schema.Struct({
  /** Universe files considered. */
  files: Count,
  /** Files with no human expert. */
  withoutExpert: Count,
  /** Files with no expert who is active. */
  withoutActiveExpert: Count,
  /** Removing these people, in this order, leaves more than half of the files without an expert. */
  truckFactor: Schema.Struct({
    value: Count,
    people: Schema.Array(Person),
  }),
  /**
   * Riskiest first: orphaned, then islands, then lower truck factor, then
   * more files, then path; possibly truncated (see `totals.directories`).
   *
   * Deprecated: the directories overlap. Read `areas` instead; this field goes
   * with schemaVersion 2. (Not an `@deprecated` tag: the repository's
   * `no-deprecated` lint would flag every producer and consumer until then.)
   */
  directories: Schema.Array(DirectoryKnowledge),
  /** The knowledge in areas that partition the files, at several levels of depth. */
  areas: Areas,
  /** Present only when the analysis ran with `blame`: the line owners of all `files` together, which no sum over `directories` gives. */
  lineOwners: Schema.optionalKey(LineOwners),
});

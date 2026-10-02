// Owns the report's knowledge section: experts, truck factor, islands, orphaned directories and line owners.
// `Report` embeds it and `InspectResult` reuses its pieces, so both describe people alike.
import { Schema } from "effect";

import { TerritoryBadge } from "./badges.js";

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
  /** A commit in the `thresholds.activeDays` days before now, over the full history; false for a dormant person. */
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
 * The knowledge state of one territory: a slice of the universe that, together
 * with its siblings, covers the files of their parent exactly once. Reads like a
 * directory, so every field of `DirectoryKnowledge` applies to the files of the
 * territory alone, `lineOwners` included: with `blame`, each territory names the
 * owners of its own lines. A territory that splits describes all of its files
 * and lists the territories it splits into.
 */
const TerritoryFields = Schema.Struct({
  ...DirectoryKnowledge.fields,
  /**
   * `package`: the root of a package, marked by a manifest such as
   * `package.json`; `folder`: a directory below a package root or below the
   * scope, or the scoped file itself when `analyze` is given a file; `other`:
   * the files of a territory that are too few to be one, grouped as "other
   * files". For `other`, `path` is the territory that holds them, or the scope
   * at the first cut, so a `package` territory and its `other` territory share
   * a path: `path` and `kind` together identify a territory within its siblings. An
   * `other` territory with fewer than `thresholds.territories.minFiles` files is
   * a leftover: `island` and `orphaned` do not apply to it, so they are false and
   * `reasons` is empty.
   */
  kind: Schema.Literals(["package", "folder", "other"]),
  /**
   * ISO timestamp of the newest commit that changed a file of the territory, over
   * the full history and by anyone, bots and agents included; a renamed file
   * counts under its current path. A universe file always has a commit, so the
   * territory always has a date.
   */
  lastChangedAt: Schema.String,
  /** Badges of the territory, most important first; the dashboard shows the first three. */
  badges: Schema.Array(TerritoryBadge),
  /** The territories it splits into before the output limit cut `territories`; 0 for a territory that does not split. */
  totalTerritories: Count,
  /**
   * Why the territory splits: "big: 52 files" when it holds many of the files,
   * or "src/api and src/ui have different experts" when its folders have
   * different main experts. Present exactly when the territory splits.
   */
  splitReason: Schema.optionalKey(Schema.String),
  /**
   * The detail from which `territories` are shown in place of this territory: 1
   * for a territory that holds more than `thresholds.territories.bigShare` of the
   * files, which is never shown whole, else at least 2. Present exactly when the
   * territory splits.
   */
  splitDetail: Schema.optionalKey(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  ),
});

type TerritoryOwn = typeof TerritoryFields.Type;

/** A territory with the territories it splits into, which cover its files exactly once. */
export type Territory = TerritoryOwn & {
  /** Ordered like `directories`: riskiest first, `other` territories last. Possibly truncated by the output limit; see `totalTerritories`. Empty for a territory that does not split. */
  readonly territories: ReadonlyArray<Territory>;
};

const Territory: Schema.Codec<Territory> = Schema.Struct({
  ...TerritoryFields.fields,
  territories: Schema.Array(
    Schema.suspend((): Schema.Codec<Territory> => Territory),
  ),
});

/**
 * The knowledge in non-overlapping territories as a tree: the first cut into
 * packages (or top-level directories) and, below it, the splits of territories that
 * are big or whose folders have different experts. A detail is how many splits are
 * open: at detail 1 the territories are the first cut, in which a territory that
 * holds most of the files is already open, and a territory is shown through its
 * children from its `splitDetail` on. Every territory carries its own
 * knowledge, so viewers only pick a detail.
 */
const Territories = Schema.Struct({
  /** The detail the terminal and the dashboard start at: `--detail`, else `recommendedDetail`. A `--detail` beyond `maxDetail` is `maxDetail`. */
  detail: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /** The detail that suits the team size, chosen with `thresholds.territories`. */
  recommendedDetail: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /** The finest detail, at most `thresholds.territories.maxDetail`; every split opens at a detail from 2 to this one. */
  maxDetail: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /**
   * The recommendation in words: "detail 2: 11 territories with 3+ files for 6
   * active contributors". It counts the territories shown at that detail that
   * are not `other`.
   */
  reason: Schema.String,
  /** The first cut before the output limit cut `territories`. */
  totalTerritories: Count,
  /** The first cut: packages, or top-level directories, and the files of neither as one `other` territory. Ordered like `directories`: riskiest first, `other` last. Possibly truncated by the output limit; see `totalTerritories`. */
  territories: Schema.Array(Territory),
});

/**
 * Who knows the code and whether they are still around. Covers the whole
 * history and the universe files of the scope, independent of `window` except for the `in-focus` territory badge. Only
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
   * Deprecated: the directories overlap. Read `territories` instead; this field goes
   * with schemaVersion 2. (Not an `@deprecated` tag: the repository's
   * `no-deprecated` lint would flag every producer and consumer until then.)
   */
  directories: Schema.Array(DirectoryKnowledge),
  /** The knowledge in territories that partition the files, as a tree with details. */
  territories: Territories,
  /** Present only when the analysis ran with `blame`: the line owners of all `files` together, which no sum over `directories` gives. */
  lineOwners: Schema.optionalKey(LineOwners),
});

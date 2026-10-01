// Owns the report's knowledge section: experts, truck factor, islands, orphaned directories and line owners.
// `Report` embeds it and `InspectResult` reuses its pieces, so both describe people alike.
import { Schema } from "effect";

const Count = Schema.Natural;

/** Who wrote the lines of a set of files, according to `git blame`. */
export const LineOwners = Schema.Struct({
  /** Non-blank lines at HEAD that blame attributed, to anyone. */
  lines: Schema.Natural,
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
 * Who knows the code and whether they are still around. Covers the whole
 * history and the universe files of the scope, independent of `window`. Only
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
   */
  directories: Schema.Array(DirectoryKnowledge),
});

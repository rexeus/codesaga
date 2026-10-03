// Owns the facts a territory's badge rules read, so the rules and the code that gathers the facts agree on one shape.
// Types only: `territory-badge-inputs.ts` gathers them, `territory-badges.ts` judges them.

import type { TerritoryTypeScript } from "../report/typescript-territory.js";

/** An expert of the territory; times are seconds since the epoch. */
export type TerritoryExpert = {
  /** Files of the territory the person is an expert on. */
  readonly files: number;
  /** Files on which the person is the only expert. */
  readonly soleFiles: number;
  /** The person's first commit to a file of the territory. */
  readonly firstTime: number;
  /** The person's last commit over the full history. */
  readonly lastTime: number;
};

/** The code stats the code badges compare, for a territory and for the repository alike. */
export type CodeFacts = {
  readonly files: number;
  readonly codeLines: number;
  readonly medianFileLines: number;
  readonly medianRevisions: number;
  /** Revisions times lines, summed over the files. */
  readonly revisionLines: number;
  readonly complexityPerLine: number;
};

/** The territories at one level of the tree, the one a territory belongs to, as the relative code badges compare them. */
export type SiblingFacts = {
  /** The named territories at the level, the territory itself included; the `other` territory is not one of them. */
  readonly count: number;
  /** Code lines of those territories together. */
  readonly codeLines: number;
  /** Revisions times lines of those territories together. */
  readonly revisionLines: number;
  /** The median, over those territories, of their median file's revisions. */
  readonly medianRevisions: number;
  /** The median, over those territories, of their indentation levels per line. */
  readonly complexityPerLine: number;
};

/** What the rules read about one territory; the caller gathers it from the knowledge model and the commits. */
export type TerritoryBadgeInput = {
  /** An `other` territory groups small leftovers and earns no badge. */
  readonly kind: "package" | "folder" | "other";
  /** The territory's root, repository-relative; "." for the repository root. */
  readonly path: string;
  /** The territory's universe files, repository-relative. */
  readonly paths: ReadonlyArray<string>;
  readonly truckFactor: number;
  readonly island: boolean;
  readonly orphaned: boolean;
  /** Every expert of the territory, not only the five the report lists, most files first. */
  readonly experts: ReadonlyArray<TerritoryExpert>;
  /** For each of the territory's files, the time of its first commit; their earliest is when the territory was created. */
  readonly fileFirstCommits: ReadonlyArray<number>;
  /** The code stats of the territory's files. */
  readonly code: CodeFacts;
  /** The code stats of the whole universe, which the code badges compare the territory with. */
  readonly repository: CodeFacts;
  /** The territories at the same level of the tree: the siblings under the same parent, or the first cut. */
  readonly siblings: SiblingFacts;
  /** The newest commit that touched any file of the territory; undefined when none is known. */
  readonly lastChangeTime: number | undefined;
  /** Human and agent-assisted commits in the last `inFocusDays` days that touched the territory. */
  readonly recentCommits: number;
  /** The most such commits that touched any other named territory with the same parent, or any other first-cut territory. */
  readonly peerRecentCommits: number;
  /** The time of the repository's first commit; a territory is `new-territory` only well after it. Undefined when unknown, as in a shallow clone: then no territory is `new-territory`. */
  readonly startTime: number | undefined;
  /** The deep dive's figures for the territory's files; absent without a deep dive or a parsed file. */
  readonly typescript?: TerritoryTypeScript | undefined;
  /** The first commit of every person who arrived after the repository started, with the paths it changed. */
  readonly firstCommits: ReadonlyArray<{
    readonly time: number;
    readonly paths: ReadonlyArray<string>;
  }>;
};

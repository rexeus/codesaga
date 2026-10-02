// Owns the facts a territory's badge rules read, so the rules and the code that gathers the facts agree on one shape.
// Types only: `territory-badge-inputs.ts` gathers them, `territory-badges.ts` judges them.

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
  /** The newest commit that touched any file of the territory; undefined when none is known. */
  readonly lastChangeTime: number | undefined;
  /** Human and agent-assisted commits in the last `inFocusDays` days that touched the territory. */
  readonly recentCommits: number;
  /** The most such commits that touched any other territory of the same detail. */
  readonly peerRecentCommits: number;
  /** The time of the repository's first commit; a territory is `new-territory` only well after it. Undefined when unknown, as in a shallow clone: then no territory is `new-territory`. */
  readonly startTime: number | undefined;
  /** The first commit of every person who arrived after the repository started, with the paths it changed. */
  readonly firstCommits: ReadonlyArray<{
    readonly time: number;
    readonly paths: ReadonlyArray<string>;
  }>;
};

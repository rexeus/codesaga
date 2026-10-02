// Owns what the contributor badge rules read: the facts about one person and the territories.
// Apart from the rules because every rule family reads the same facts.
import type { DateTime } from "effect";

import type { ClassifiedCommit } from "../automation/classify.js";

/** A territory of the recommended detail as the badges read it. */
export type ContributorBadgeTerritory = {
  readonly path: string;
  /** An `other` territory groups small leftovers and earns nobody a badge. */
  readonly kind: "package" | "folder" | "other";
  /** The territory's universe files, repository-relative. */
  readonly paths: ReadonlyArray<string>;
  /** Emails of the experts with a commit in the activity window of `thresholds.activeDays`. */
  readonly activeExperts: ReadonlyArray<string>;
};

export type ContributorBadgeFacts = {
  /** The contributor's own human and agent-assisted commits over the full history, newest first. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  readonly now: DateTime.Utc;
  /**
   * The time of the first commit of anyone who counts as a contributor, over
   * the full history; `new-here` needs someone earlier. Undefined when the
   * history is incomplete, as in a shallow clone: then `new-here`,
   * `long-hauler` and `explorer` are withheld.
   */
  readonly repositoryStart: number | undefined;
  /**
   * The territories of the recommended detail; they decide all-rounder,
   * specialist, keeper and explorer, which are withheld without them.
   */
  readonly territories?: ReadonlyArray<ContributorBadgeTerritory>;
  /** How many people count as contributors over the full history; with one, `all-rounder` and `keeper` compare against nobody and are withheld. */
  readonly historyContributors: number;
  /**
   * Whether any human commit of the full history carries an offset other than
   * +00:00. The rhythm badges are withheld from a person whose commits all say
   * UTC when others' do not, since such machines are probably set to UTC.
   */
  readonly historyHasOtherOffsets: boolean;
  /** Whether a changed path counts toward code lines. */
  readonly isCodePath: (path: string) => boolean;
  /** The universe files the contributor created, and all universe files, for `founder`. */
  readonly founded: { readonly files: number; readonly ofFiles: number };
};

/** The facts plus the person's identity, as a rule reads them. */
export type BadgeContext = ContributorBadgeFacts & {
  readonly email: string;
};

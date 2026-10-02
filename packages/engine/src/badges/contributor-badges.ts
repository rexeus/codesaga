// Owns the badges of one contributor: which positive or neutral achievements their commits earn, in priority order.
// Apart from the contributors section because the rules need the territories, the full history and the files each person founded.
// Cost: a few passes over the contributor's own commits plus one lookup per changed path into the territories.

import type { DateTime } from "effect";

import type { ClassifiedCommit } from "../automation/classify.js";
import { countCodeLines } from "../history/history.js";
import type { ContributorBadge } from "../report/badges.js";
import { territoryNameOf, percentOf } from "../report/sentences.js";
import { isDocPath, isTestPath } from "../universe/path-kinds.js";
import { categorized } from "./contributor-badge-category.js";
import type { EarnedContributorBadge } from "./contributor-badge-category.js";
import { TENURE_BADGE_THRESHOLDS, tenureBadges } from "./contributor-tenure.js";

/** The rules behind the contributor badges, for the report's `thresholds.badges`. */
export const CONTRIBUTOR_BADGE_THRESHOLDS = {
  allRounderTerritoryShare: 0.5,
  allRounderMinTerritories: 4,
  specialistShare: 0.8,
  tidierNetDeletedLines: 500,
  founderShare: 0.25,
  testerShare: 0.4,
  documenterShare: 0.4,
  minCommitsForShare: 10,
  ...TENURE_BADGE_THRESHOLDS,
  /** Reserved: `reviewer` needs GitHub logins mapped to identities and is not awarded yet. */
  reviewerReviews: 10,
};

const {
  allRounderTerritoryShare,
  allRounderMinTerritories,
  specialistShare,
  tidierNetDeletedLines,
  founderShare,
  testerShare,
  documenterShare,
  minCommitsForShare,
} = CONTRIBUTOR_BADGE_THRESHOLDS;

/** A territory of the recommended detail as the badges read it. */
type ContributorBadgeTerritory = {
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
   * history is incomplete, as in a shallow clone: then `new-here` is withheld.
   */
  readonly repositoryStart: number | undefined;
  /**
   * The territories of the recommended detail; they decide all-rounder, specialist
   * and keeper, which are withheld without them.
   */
  readonly territories?: ReadonlyArray<ContributorBadgeTerritory>;
  /** How many people count as contributors over the full history; with one, `all-rounder` and `keeper` compare against nobody and are withheld. */
  readonly historyContributors: number;
  /** Whether a changed path counts toward code lines. */
  readonly isCodePath: (path: string) => boolean;
  /** The universe files the contributor created, and all universe files, for `founder`. */
  readonly founded: { readonly files: number; readonly ofFiles: number };
};

type Context = ContributorBadgeFacts & {
  readonly email: string;
};

type TerritoryActivity = {
  /** Commits per territory, each commit counting once per territory it touches; territories without a commit are absent. */
  readonly perTerritory: ReadonlyMap<ContributorBadgeTerritory, number>;
  /** Commits that touch at least one of the territories. */
  readonly inTerritories: number;
};

const territoryActivity = (
  commits: ReadonlyArray<ClassifiedCommit>,
  territories: ReadonlyArray<ContributorBadgeTerritory>,
): TerritoryActivity => {
  const territoryOfPath = new Map(
    namedTerritories(territories).flatMap((territory) =>
      territory.paths.map((path) => [path, territory] as const),
    ),
  );
  const perTerritory = new Map<ContributorBadgeTerritory, number>();
  let inTerritories = 0;
  for (const { changes } of commits) {
    const touched = new Set(
      changes.flatMap(({ path }) => territoryOfPath.get(path) ?? []),
    );
    inTerritories += touched.size > 0 ? 1 : 0;
    for (const territory of touched) {
      perTerritory.set(territory, (perTerritory.get(territory) ?? 0) + 1);
    }
  }
  return { perTerritory, inTerritories };
};

const namedTerritories = (
  territories: ReadonlyArray<ContributorBadgeTerritory>,
): ReadonlyArray<ContributorBadgeTerritory> =>
  territories.filter(({ kind }) => kind !== "other");

/** With one contributor in the history there is nobody to set a person against. */
const isSolo = ({ historyContributors }: Context): boolean =>
  historyContributors <= 1;

const allRounder = (context: Context) => {
  const { commits, territories = [] } = context;
  const total = namedTerritories(territories).length;
  const touched = territoryActivity(commits, territories).perTerritory.size;
  return !isSolo(context) &&
    touched >= allRounderMinTerritories &&
    touched / total >= allRounderTerritoryShare
    ? {
        kind: "all-rounder" as const,
        label: "All-rounder",
        evidence: `Commits in ${touched} of ${total} territories.`,
      }
    : undefined;
};

const specialist = ({ commits, territories = [] }: Context) => {
  const { perTerritory, inTerritories } = territoryActivity(
    commits,
    territories,
  );
  const [top] = [...perTerritory].toSorted(
    ([a, countA], [b, countB]) =>
      countB - countA || a.path.localeCompare(b.path),
  );
  return top !== undefined &&
    inTerritories >= minCommitsForShare &&
    top[1] / inTerritories >= specialistShare
    ? {
        kind: "specialist" as const,
        label: `${territoryNameOf(top[0].path, true)} specialist`,
        evidence: `${percentOf(top[1] / inTerritories)} of the commits fall into ${territoryNameOf(top[0].path)}.`,
      }
    : undefined;
};

const tidier = ({ commits, isCodePath }: Context) => {
  const { added, deleted } = countCodeLines(commits, isCodePath);
  return deleted - added >= tidierNetDeletedLines
    ? {
        kind: "tidier" as const,
        label: "Tidier",
        evidence: `Removed ${deleted - added} more code lines than added.`,
      }
    : undefined;
};

const founder = ({ founded }: Context) =>
  founded.ofFiles > 0 && founded.files / founded.ofFiles >= founderShare
    ? {
        kind: "founder" as const,
        label: "Founder",
        evidence: `First author of ${percentOf(founded.files / founded.ofFiles)} of today's files.`,
      }
    : undefined;

const keeper = (context: Context) => {
  const { email, territories = [] } = context;
  if (isSolo(context)) {
    return undefined;
  }
  const [largest] = namedTerritories(territories)
    .filter(
      ({ activeExperts }) =>
        activeExperts.length === 1 && activeExperts[0] === email,
    )
    .toSorted(
      (a, b) => b.paths.length - a.paths.length || a.path.localeCompare(b.path),
    );
  return largest === undefined
    ? undefined
    : {
        kind: "keeper" as const,
        label: `Keeper of ${territoryNameOf(largest.path)}`,
        evidence: `The only active expert of ${territoryNameOf(largest.path)}.`,
      };
};

const tester = ({ commits }: Context) => {
  const paths = new Set(
    commits.flatMap(({ changes }) => changes.map(({ path }) => path)),
  );
  const tests = [...paths].filter((path) => isTestPath(path)).length;
  return commits.length >= minCommitsForShare &&
    tests / paths.size >= testerShare
    ? {
        kind: "tester" as const,
        label: "Tester",
        evidence: `${percentOf(tests / paths.size)} of the changed files are tests.`,
      }
    : undefined;
};

const documenter = ({ commits }: Context) => {
  const documenting = commits.filter(({ changes }) =>
    changes.some(({ path }) => isDocPath(path)),
  ).length;
  return commits.length >= minCommitsForShare &&
    documenting / commits.length >= documenterShare
    ? {
        kind: "documenter" as const,
        label: "Documenter",
        evidence: `${percentOf(documenting / commits.length)} of the commits touch documentation.`,
      }
    : undefined;
};

const RULES: ReadonlyArray<
  (context: Context) => EarnedContributorBadge | undefined
> = [allRounder, specialist, tidier, founder, keeper, tester, documenter];

/**
 * The badges the contributor earns, ordered by category (focus, craft, rhythm,
 * collaboration, journey) and by rule within a category. Positive or neutral
 * only. `new-here` stands in for the "new" status
 * pill. Each carries its rule and the numbers behind it as evidence.
 * `reviewer` is never awarded: GitHub reviews are not tied to identities yet.
 * Without `facts.territories` the three badges that need territories are withheld; in a
 * repository with one contributor over the full history `all-rounder` and
 * `keeper` are too, since they would compare the person with nobody.
 */
export const contributorBadges = (
  email: string,
  facts: ContributorBadgeFacts,
): ReadonlyArray<ContributorBadge> => {
  if (facts.commits.length === 0) {
    return [];
  }
  const context = { ...facts, email };
  return categorized([
    ...RULES.flatMap((rule) => rule(context) ?? []),
    ...tenureBadges(facts.commits, facts.repositoryStart, facts.now),
  ]);
};

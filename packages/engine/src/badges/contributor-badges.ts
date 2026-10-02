// Owns the badges of one contributor: which positive or neutral achievements their commits earn, in priority order.
// Apart from the contributors section because the rules need the areas, the full history and the files each person founded.
// Cost: a few passes over the contributor's own commits plus one lookup per changed path into the areas.

import type { DateTime } from "effect";

import type { ClassifiedCommit } from "../automation/classify.js";
import { countCodeLines } from "../history/history.js";
import type { ContributorBadge } from "../report/badges.js";
import { percentOf } from "../report/sentences.js";
import { isDocPath, isTestPath } from "../universe/path-kinds.js";
import { TENURE_BADGE_THRESHOLDS, tenureBadges } from "./contributor-tenure.js";

/** The rules behind the contributor badges, for the report's `thresholds.badges`. */
export const CONTRIBUTOR_BADGE_THRESHOLDS = {
  allRounderAreaShare: 0.5,
  allRounderMinAreas: 4,
  specialistShare: 0.8,
  cleanerNetDeletedLines: 500,
  founderShare: 0.25,
  testerShare: 0.4,
  documenterShare: 0.4,
  minCommitsForShare: 10,
  ...TENURE_BADGE_THRESHOLDS,
  /** Reserved: `reviewer` needs GitHub logins mapped to identities and is not awarded yet. */
  reviewerReviews: 10,
};

const {
  allRounderAreaShare,
  allRounderMinAreas,
  specialistShare,
  cleanerNetDeletedLines,
  founderShare,
  testerShare,
  documenterShare,
  minCommitsForShare,
} = CONTRIBUTOR_BADGE_THRESHOLDS;

/** An area of the recommended level as the badges read it. */
type ContributorBadgeArea = {
  readonly path: string;
  /** A `rest` area groups small leftovers and earns nobody a badge. */
  readonly kind: "package" | "directory" | "rest";
  /** The area's universe files, repository-relative. */
  readonly paths: ReadonlyArray<string>;
  /** Emails of the experts with a commit in the activity window of `thresholds.activeDays`. */
  readonly activeExperts: ReadonlyArray<string>;
};

export type ContributorBadgeFacts = {
  /** The contributor's own human and agent-assisted commits over the full history, newest first. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  readonly now: DateTime.Utc;
  /**
   * The areas of the recommended level; they decide all-rounder, specialist
   * and keeper, which are withheld without them.
   */
  readonly areas?: ReadonlyArray<ContributorBadgeArea>;
  /** Whether a changed path counts toward code lines. */
  readonly isCodePath: (path: string) => boolean;
  /** The universe files the contributor created, and all universe files, for `founder`. */
  readonly founded: { readonly files: number; readonly ofFiles: number };
};

type Context = ContributorBadgeFacts & {
  readonly email: string;
};

type AreaActivity = {
  /** Commits per area, each commit counting once per area it touches; areas without a commit are absent. */
  readonly perArea: ReadonlyMap<ContributorBadgeArea, number>;
  /** Commits that touch at least one of the areas. */
  readonly inAreas: number;
};

const areaActivity = (
  commits: ReadonlyArray<ClassifiedCommit>,
  areas: ReadonlyArray<ContributorBadgeArea>,
): AreaActivity => {
  const areaOfPath = new Map(
    namedAreas(areas).flatMap((area) =>
      area.paths.map((path) => [path, area] as const),
    ),
  );
  const perArea = new Map<ContributorBadgeArea, number>();
  let inAreas = 0;
  for (const { changes } of commits) {
    const touched = new Set(
      changes.flatMap(({ path }) => areaOfPath.get(path) ?? []),
    );
    inAreas += touched.size > 0 ? 1 : 0;
    for (const area of touched) {
      perArea.set(area, (perArea.get(area) ?? 0) + 1);
    }
  }
  return { perArea, inAreas };
};

const namedAreas = (
  areas: ReadonlyArray<ContributorBadgeArea>,
): ReadonlyArray<ContributorBadgeArea> =>
  areas.filter(({ kind }) => kind !== "rest");

const allRounder = ({ commits, areas = [] }: Context) => {
  const total = namedAreas(areas).length;
  const touched = areaActivity(commits, areas).perArea.size;
  return touched >= allRounderMinAreas && touched / total >= allRounderAreaShare
    ? {
        kind: "all-rounder" as const,
        label: "All-rounder",
        evidence: `Commits in ${touched} of ${total} areas.`,
      }
    : undefined;
};

const specialist = ({ commits, areas = [] }: Context) => {
  const { perArea, inAreas } = areaActivity(commits, areas);
  const [top] = [...perArea].toSorted(
    ([a, countA], [b, countB]) =>
      countB - countA || a.path.localeCompare(b.path),
  );
  return top !== undefined &&
    inAreas >= minCommitsForShare &&
    top[1] / inAreas >= specialistShare
    ? {
        kind: "specialist" as const,
        label: `Specialist: ${top[0].path}`,
        evidence: `${percentOf(top[1] / inAreas)} of the commits fall into ${top[0].path}.`,
      }
    : undefined;
};

const cleaner = ({ commits, isCodePath }: Context) => {
  const { added, deleted } = countCodeLines(commits, isCodePath);
  return deleted - added >= cleanerNetDeletedLines
    ? {
        kind: "cleaner" as const,
        label: "Cleaner",
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

const keeper = ({ email, areas = [] }: Context) => {
  const [largest] = namedAreas(areas)
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
        label: `Keeper of ${largest.path}`,
        evidence: `The only active expert of ${largest.path}.`,
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

const RULES: ReadonlyArray<(context: Context) => ContributorBadge | undefined> =
  [allRounder, specialist, cleaner, founder, keeper, tester, documenter];

/**
 * The badges the contributor earns, most important first. Positive or neutral
 * only, and none about working hours. `welcome` stands in for the "new" status
 * pill. Each carries its rule and the numbers behind it as evidence.
 * `reviewer` is never awarded: GitHub reviews are not tied to identities yet.
 * Without `facts.areas` the three badges that need areas are withheld.
 */
export const contributorBadges = (
  email: string,
  facts: ContributorBadgeFacts,
): ReadonlyArray<ContributorBadge> => {
  if (facts.commits.length === 0) {
    return [];
  }
  const context = { ...facts, email };
  return [
    ...RULES.flatMap((rule) => rule(context) ?? []),
    ...tenureBadges(facts.commits, facts.now),
  ];
};

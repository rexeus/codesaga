// Owns the focus badges: all-rounder, specialist and keeper, which read where a person works.
// Apart from `contributor-badges.ts` because they need the territories and the head count of the history.
// Cost: one pass over the contributor's commits plus one lookup per changed path into the territories.
import { territoryNameOf, percentOf } from "../report/sentences.js";
import type { BadgeContext } from "./contributor-badge-facts.js";
import { CONTRIBUTOR_BADGE_THRESHOLDS } from "./contributor-badge-thresholds.js";
import {
  namedTerritories,
  territoryActivity,
} from "./contributor-territories.js";

const {
  allRounderTerritoryShare,
  allRounderMinTerritories,
  specialistShare,
  minCommitsForShare,
} = CONTRIBUTOR_BADGE_THRESHOLDS;

/** With one contributor in the history there is nobody to set a person against. */
const isSolo = ({ historyContributors }: BadgeContext): boolean =>
  historyContributors <= 1;

export const allRounder = (context: BadgeContext) => {
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

export const specialist = ({ commits, territories = [] }: BadgeContext) => {
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

export const keeper = (context: BadgeContext) => {
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

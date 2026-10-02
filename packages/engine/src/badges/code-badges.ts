// Owns the code badges that compare a territory's code stats with the repository's: heavyweight, hotspot, churning and deeply nested.
// Heavyweight and hotspot also compare the territory with its siblings, so that a small cut does not badge everything.
// Facts only: each badge says how the territory differs from the repository, never that it is good or bad.

import { countOf, percentOf } from "../report/sentences.js";
import type { CodeFacts, SiblingFacts } from "./territory-badge-facts.js";
import { TERRITORY_BADGE_THRESHOLDS } from "./territory-badge-thresholds.js";

const {
  heavyweightShare,
  heavyweightMedianFileLines,
  hotspotShare,
  churningRatio,
  churningMinRevisions,
  nestedRatio,
  nestedMinLevels,
  codeBadgeMinSiblings,
  codeBadgeFairShareFactor,
} = TERRITORY_BADGE_THRESHOLDS;

type CodeContext = {
  readonly code: CodeFacts;
  readonly repository: CodeFacts;
  readonly siblings: SiblingFacts;
};

const shareOf = (part: number, whole: number): number =>
  whole === 0 ? 0 : part / whole;

/** Whether `share` of the siblings' total is at least the factor times the fair share among at least the minimum of them. */
const dominatesSiblings = (share: number, { count }: SiblingFacts): boolean =>
  count >= codeBadgeMinSiblings && share >= codeBadgeFairShareFactor / count;

/** A number with at most one decimal: "6", "6.5". */
const figure = (value: number): string => countOf(Math.round(value * 10) / 10);

/**
 * Heavyweight: a share of the repository's code lines, or long files, and a
 * share of the siblings' code lines of at least twice the fair share among at
 * least three of them.
 */
export const heavyweight = ({ code, repository, siblings }: CodeContext) => {
  const share = shareOf(code.codeLines, repository.codeLines);
  const among = shareOf(code.codeLines, siblings.codeLines);
  const reasons = [
    ...(share >= heavyweightShare
      ? [`Holds ${percentOf(share)} of the repository's code lines.`]
      : []),
    ...(code.medianFileLines >= heavyweightMedianFileLines
      ? [`The median file has ${figure(code.medianFileLines)} lines.`]
      : []),
  ];
  return reasons.length > 0 && dominatesSiblings(among, siblings)
    ? {
        kind: "heavyweight" as const,
        label: "Heavyweight",
        evidence: `${reasons.join(" ")} It holds ${percentOf(among)} of the code lines of its ${siblings.count} sibling territories.`,
      }
    : undefined;
};

/**
 * Hotspot: a share of the repository's revisions times lines, after codeheat's
 * churn times size, and a share among the siblings of at least twice the fair
 * share among at least three of them.
 */
export const hotspot = ({ code, repository, siblings }: CodeContext) => {
  const share = shareOf(code.revisionLines, repository.revisionLines);
  const among = shareOf(code.revisionLines, siblings.revisionLines);
  return share >= hotspotShare && dominatesSiblings(among, siblings)
    ? {
        kind: "hotspot" as const,
        label: "Hotspot",
        evidence: `${percentOf(share)} of the repository's revisions times lines sit here, the hotspot measure of codeheat, and ${percentOf(among)} among its ${siblings.count} sibling territories.`,
      }
    : undefined;
};

/** Churning: a median file revised much more often than the repository's median file. */
export const churning = ({ code, repository }: CodeContext) =>
  code.medianRevisions >=
  Math.max(churningMinRevisions, churningRatio * repository.medianRevisions)
    ? {
        kind: "churning" as const,
        label: "Churning",
        evidence: `The median file changed ${figure(code.medianRevisions)} times, the repository's ${figure(repository.medianRevisions)}.`,
      }
    : undefined;

/** Deeply nested: more indentation levels per line than the repository has, by a margin. */
export const deeplyNested = ({ code, repository }: CodeContext) =>
  code.complexityPerLine >=
  Math.max(nestedMinLevels, nestedRatio * repository.complexityPerLine)
    ? {
        kind: "deeply-nested" as const,
        label: "Deeply nested",
        evidence: `${code.complexityPerLine.toFixed(2)} indentation levels per line, the repository's ${repository.complexityPerLine.toFixed(2)}.`,
      }
    : undefined;

import {
  compareOnBar,
  formatWhole,
  formatLevels,
  formatShare,
  indentationOf,
  pathTail,
  rangePosition,
} from "./code-stats.js";
import type { CodeStats, Comparison, Indentation } from "./code-stats.js";
import { formatCount, formatNoun } from "./format.js";
import { languageShares } from "./languages.js";
import type { LanguageShare } from "./languages.js";

/** How many languages the legend under a territory's language bar names. */
const LEGEND_LANGUAGES = 4;

/** A figure held against the repository's: both on one bar. */
type Held = {
  readonly figure: string;
  readonly comparison: Comparison;
};

/** The stats of one territory, worded for its stats panel and held against the repository's where that tells something. */
export type TerritoryStatsView = {
  readonly languages: readonly LanguageShare[];
  readonly legend: readonly LanguageShare[];
  readonly files: string;
  readonly lines: string;
  readonly fileLength: {
    readonly min: string;
    readonly median: string;
    readonly max: string;
    /** The median's place between the shortest and the longest file, 0 to 1. */
    readonly position: number;
  };
  readonly tests: {
    /** `45%`. */
    readonly share: string;
    /** `60 of 134 files are tests, 57% of the lines`. */
    readonly caption: string;
    readonly files: number;
    readonly otherFiles: number;
  };
  readonly churn: Held & {
    readonly p90: string;
    /** The most changed file, by its tail path and revisions, or null without any. */
    readonly mostChanged: {
      readonly name: string;
      readonly path: string;
      readonly revisions: string;
    } | null;
  };
  readonly complexity: Held & {
    readonly medianFile: string;
    readonly deepest: {
      readonly name: string;
      readonly path: string;
      readonly perLine: string;
    } | null;
  };
  readonly style: {
    readonly indentation: Indentation;
    readonly lineLength: { readonly median: string; readonly p90: string };
    readonly comments: string;
  };
};

const mostChangedOf = ({
  churn,
}: CodeStats): TerritoryStatsView["churn"]["mostChanged"] => {
  const [top] = churn.mostChanged;
  return top === undefined
    ? null
    : {
        name: pathTail(top.path),
        path: top.path,
        revisions: formatCount(top.revisions),
      };
};

const deepestOf = ({
  complexity,
}: CodeStats): TerritoryStatsView["complexity"]["deepest"] =>
  complexity.deepestFile === null
    ? null
    : {
        name: pathTail(complexity.deepestFile.path),
        path: complexity.deepestFile.path,
        perLine: formatLevels(complexity.deepestFile.perLine),
      };

/**
 * The panel of a territory: its stats against the `repository`'s, with
 * languages colored by `entityOf` so a language keeps its color across the
 * page. Nothing here judges: a figure above the repository's is only a mark
 * further along the bar.
 */
export const territoryStats = (
  stats: CodeStats,
  repository: CodeStats,
  entityOf: (language: string) => string,
): TerritoryStatsView => {
  const languages = languageShares(
    stats.languages.map(({ name, files, lines }) => ({
      name,
      files,
      loc: lines,
    })),
    entityOf,
  );
  const { fileLength, tests, churn, complexity, style } = stats;
  return {
    languages,
    legend: languages.slice(0, LEGEND_LANGUAGES),
    files: formatCount(stats.files),
    lines: formatCount(stats.codeLines),
    fileLength: {
      min: formatCount(fileLength.min),
      median: formatWhole(fileLength.median),
      max: formatCount(fileLength.max),
      position: rangePosition(
        fileLength.min,
        fileLength.median,
        fileLength.max,
      ),
    },
    tests: {
      share: formatShare(tests.files, stats.files),
      caption: `${formatCount(tests.files)} of ${formatNoun(stats.files, "file")} ${stats.files === 1 ? "is a test" : "are tests"}, ${formatShare(tests.lines, stats.codeLines)} of the lines`,
      files: tests.files,
      otherFiles: stats.files - tests.files,
    },
    churn: {
      figure: formatWhole(churn.median),
      comparison: compareOnBar(churn.median, repository.churn.median),
      p90: formatWhole(churn.p90),
      mostChanged: mostChangedOf(stats),
    },
    complexity: {
      figure: formatLevels(complexity.perLine),
      comparison: compareOnBar(
        complexity.perLine,
        repository.complexity.perLine,
      ),
      medianFile: formatLevels(complexity.medianFile),
      deepest: deepestOf(stats),
    },
    style: {
      indentation: indentationOf(style.indent),
      lineLength: {
        median: formatWhole(style.lineLength.median),
        p90: formatWhole(style.lineLength.p90),
      },
      comments: formatShare(style.commentLines.lines, stats.codeLines),
    },
  };
};

import type { Report } from "@codesaga/engine";

import { compareOnBar } from "./code-stats.js";
import type { Comparison } from "./code-stats.js";
import {
  formatCount,
  formatNoun,
  formatPercent,
  formatPercentTenth,
  formatPerThousand,
} from "./format.js";

type Territory = Report["knowledge"]["territories"]["territories"][number];
type TerritoryTypeScript = NonNullable<Territory["typescript"]>;

/** The TypeScript lines of a territory's stats panel. Each line exists only where the report has the figure. */
export type TerritoryTypeScriptView = {
  /** `38 files · 4,300 lines`. */
  readonly size: string;
  /** Escape sites per 1,000 production lines, held against the repository's when it has them. */
  readonly escapes: (Comparison & { readonly figure: string }) | null;
  /** `strict on`, `strict off`, `strict mixed` or `strict unknown`. */
  readonly strict: string | null;
  /** `100%` of the files that use a module system are ES modules. */
  readonly esm: string | null;
  /** The share of functions scoring 15 or more and the hardest score. */
  readonly complexity: {
    readonly share: string;
    readonly max: string;
    /** `40 of 325`, or null when the report does not carry the counts. */
    readonly counts: string | null;
  } | null;
  /** The territories this one imports and is imported by; null without the import map. */
  readonly imports: {
    readonly imports: string;
    readonly importedBy: string;
  } | null;
  /** True when a cycle of files runs through the territory. */
  readonly inCycle: boolean;
};

const strictWord = (
  strict: NonNullable<TerritoryTypeScript["strict"]>,
): string => {
  if (typeof strict === "string") {
    return strict;
  }
  return strict ? "on" : "off";
};

const escapesOf = (
  { escapesPer1000 }: TerritoryTypeScript,
  repositoryRate: number | undefined,
): TerritoryTypeScriptView["escapes"] =>
  escapesPer1000 === undefined
    ? null
    : {
        figure: formatPerThousand(escapesPer1000),
        ...compareOnBar(escapesPer1000, repositoryRate ?? escapesPer1000),
      };

const importsOf = ({
  importsCount,
  importedByCount,
}: TerritoryTypeScript): TerritoryTypeScriptView["imports"] =>
  importsCount === undefined || importedByCount === undefined
    ? null
    : {
        imports: formatCount(importsCount),
        importedBy: formatCount(importedByCount),
      };

/**
 * The TypeScript lines of a territory, or null for a territory with no parsed
 * file. The territory's escape rate is held against the repository's on one
 * bar, like the stats above it; nothing here is graded.
 */
export const territoryTypeScript = (
  territory: Territory,
  repository: NonNullable<Report["deepDives"]>["typescript"],
): TerritoryTypeScriptView | null => {
  const figures = territory.typescript;
  if (figures === undefined) {
    return null;
  }
  const {
    files,
    codeLines,
    strict,
    esmShare,
    over15Share,
    maxComplexity,
    functions,
    complexFunctions,
  } = figures;
  return {
    size: `${formatNoun(files, "file")} · ${formatNoun(codeLines, "line")}`,
    escapes: escapesOf(
      figures,
      repository?.typeSafety?.production.escapesPer1000,
    ),
    strict: strict === undefined ? null : `strict ${strictWord(strict)}`,
    esm: esmShare === undefined ? null : formatPercent(esmShare),
    complexity:
      over15Share === undefined || maxComplexity === undefined
        ? null
        : {
            share: formatPercentTenth(over15Share),
            max: formatCount(maxComplexity),
            counts:
              functions === undefined || complexFunctions === undefined
                ? null
                : `${formatCount(complexFunctions)} of ${formatCount(functions)}`,
          },
    imports: importsOf(figures),
    inCycle: figures.inCycle === true,
  };
};

// Owns the TypeScript part of a report: the deep dive at HEAD with, where the history was parsed, its trends.
// Pure, like the rest of the report's composition.
import { DateTime } from "effect";

import type { Report } from "../report/report.js";
import type { Imports } from "../report/typescript-imports.js";
import type { FlagEvent } from "../report/typescript-trends.js";
import { typescriptAnalysis } from "../typescript/deep-dive.js";
import type { TypeScriptAnalysis } from "../typescript/deep-dive.js";
import type { TypeScriptFacts } from "../typescript/gather-typescript.js";
import { factsLookupOf } from "../typescript/trends/facts-lookup.js";
import type { FactsLookup } from "../typescript/trends/facts-lookup.js";
import { trendsOf } from "../typescript/trends/trends.js";
import type { Analysis } from "./prepare.js";
import type { ReportFacts } from "./report-facts.js";

/** The deep dive, and what the sections beside it read of the trends before the report cuts them. */
export type ReportTypeScript = TypeScriptAnalysis & {
  /** Every flip of `strict` and `noUncheckedIndexedAccess` over the whole history, oldest first; `trends.events` keeps the newest 20. Empty without trends. */
  readonly allFlagEvents: ReadonlyArray<FlagEvent>;
};

const hasParsedFile = ({ files }: TypeScriptFacts): boolean =>
  files.some(({ result }) => result.kind === "parsed");

/**
 * The deep dive over HEAD's files, or undefined when the universe has none.
 * It gains `trends` when the history was parsed and some file of it is.
 * `revisions` are the commits per path in its current life; `commits` are
 * those of the activity window.
 */
export const typescriptOf = (
  facts: ReportFacts,
  revisions: ReadonlyMap<string, number>,
  { commits }: Pick<Analysis, "commits">,
): ReportTypeScript | undefined => {
  const { typescript, historyFacts, repository, now } = facts;
  if (typescript === undefined) {
    return undefined;
  }
  const built =
    historyFacts === undefined || !hasParsedFile(typescript)
      ? undefined
      : trendsOf({
          window: commits,
          historyFacts,
          scope: repository.scope,
          now,
        });
  const analysis = typescriptAnalysis(
    typescript,
    revisions,
    repository.shallow,
    built === undefined
      ? undefined
      : { trends: built.trends, today: DateTime.formatIso(now).slice(0, 10) },
  );
  return built === undefined
    ? { ...analysis, allFlagEvents: [] }
    : {
        ...analysis,
        section: { ...analysis.section, trends: built.trends },
        allFlagEvents: built.allFlagEvents,
      };
};

/** The facts of the history's file versions, for the badges that compare code before and after a commit; undefined where the history was not parsed. */
export const historyLookupOf = ({
  historyFacts,
}: ReportFacts): FactsLookup | undefined =>
  historyFacts === undefined ? undefined : factsLookupOf(historyFacts);

/** The report's `deepDives`: the TypeScript analysis with the import structure the knowledge pass found, absent when the universe has no TypeScript. */
export const deepDivesOf = (
  typescript: TypeScriptAnalysis | undefined,
  imports: Imports | undefined,
): Pick<Report, "deepDives"> =>
  typescript === undefined
    ? {}
    : {
        deepDives: {
          typescript: {
            ...typescript.section,
            ...(imports === undefined ? {} : { imports }),
          },
        },
      };

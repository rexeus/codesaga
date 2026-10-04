// Owns the TypeScript part of a report: the deep dive at HEAD with, where the history was parsed, its trends.
// Pure, like the rest of the report's composition.
import type { Report } from "../report/report.js";
import type { Imports } from "../report/typescript-imports.js";
import { typescriptAnalysis } from "../typescript/deep-dive.js";
import type { TypeScriptAnalysis } from "../typescript/deep-dive.js";
import type { TypeScriptFacts } from "../typescript/gather-typescript.js";
import type { TrendInput } from "../typescript/trend-input.js";
import { factsLookupOf } from "../typescript/trends/facts-lookup.js";
import type { FactsLookup } from "../typescript/trends/facts-lookup.js";
import { trendsOf } from "../typescript/trends/trends.js";
import type { TrendsResult } from "../typescript/trends/trends.js";
import type { Analysis } from "./prepare.js";
import type { ReportFacts } from "./report-facts.js";

/** The deep dive, and what the sections beside it read of the trends before the report cuts them. */
export type ReportTypeScript = TypeScriptAnalysis & {
  /**
   * The trends as the stories and achievements read them: every flip of
   * `strict` and `noUncheckedIndexedAccess` over the whole history, where
   * `trends.events` keeps the newest 20, and the day of the commit each month's
   * point is the state after. Undefined without trends.
   */
  readonly history: TrendInput | undefined;
};

/** The trends as the stories and achievements read them: every flag flip, and the day of each month's commit. */
const trendInputOf = ({
  trends,
  allFlagEvents,
  lastCommitDays,
}: TrendsResult): TrendInput => ({
  ...trends,
  events: allFlagEvents,
  lastCommitDays,
});

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
  const history = built === undefined ? undefined : trendInputOf(built);
  const analysis = typescriptAnalysis(
    typescript,
    revisions,
    repository.shallow,
    history,
  );
  return history === undefined || built === undefined
    ? { ...analysis, history: undefined }
    : {
        ...analysis,
        section: { ...analysis.section, trends: built.trends },
        history,
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

import type { Report } from "@codesaga/engine";

/** The contributors and knowledge directories `analyze` reports in JSON when nothing sets a limit. */
export const DEFAULT_LIMIT = 25;

type Territory = Report["knowledge"]["territories"]["territories"][number];

/** The first `limit` territories, and below each the first `limit` of its own, recursively. */
const limitTerritories = (
  territories: ReadonlyArray<Territory>,
  limit: number,
): ReadonlyArray<Territory> =>
  territories.slice(0, limit).map((territory) =>
    Object.assign({}, territory, {
      territories: limitTerritories(territory.territories, limit),
    }),
  );

type TypeScriptDeepDive = NonNullable<
  NonNullable<Report["deepDives"]>["typescript"]
>;

type FunctionsPart = NonNullable<TypeScriptDeepDive["functions"]>["tests"];

const limitFunctions = (part: FunctionsPart, limit: number): FunctionsPart => ({
  ...part,
  top: part.top.slice(0, limit),
});

/** The lists of the TypeScript deep dive cut to the first `limit`: the `tsconfig` postures (`totalConfigs` keeps their count), the hardest functions, the hotspot files and the focused test files. */
const limitTypeScript = (
  typescript: TypeScriptDeepDive,
  limit: number,
): TypeScriptDeepDive => {
  const { strictness, functions, complexityAndChange, tests } = typescript;
  return {
    ...typescript,
    ...(strictness === undefined
      ? {}
      : {
          strictness: {
            ...strictness,
            configs: strictness.configs.slice(0, limit),
          },
        }),
    ...(functions === undefined
      ? {}
      : {
          functions: {
            production: limitFunctions(functions.production, limit),
            tests: limitFunctions(functions.tests, limit),
          },
        }),
    ...(complexityAndChange === undefined
      ? {}
      : {
          complexityAndChange: {
            ...complexityAndChange,
            hotspots: complexityAndChange.hotspots.slice(0, limit),
          },
        }),
    ...(tests === undefined
      ? {}
      : {
          tests: { ...tests, focusedFiles: tests.focusedFiles.slice(0, limit) },
        }),
  };
};

const limitDeepDives = (
  deepDives: NonNullable<Report["deepDives"]>,
  limit: number,
): NonNullable<Report["deepDives"]> =>
  deepDives.typescript === undefined
    ? deepDives
    : {
        ...deepDives,
        typescript: limitTypeScript(deepDives.typescript, limit),
      };

/**
 * Applies `--limit` to a report: `contributors` is cut to its first `limit`
 * entries and so are the knowledge `directories`, the first-cut `territories` and
 * the territories inside each one (already ordered by risk; `totalTerritories`
 * keeps the full count of each list), `0`
 * keeps everything, and `totals` still describes the untruncated size.
 * The pull request authors and reviewers are cut the same way, with their
 * sizes in `pullRequests.totals`, and so are the lists of the TypeScript deep
 * dive: the `tsconfig` postures, with their number in `strictness.totalConfigs`,
 * the hardest functions, the hotspot files and the focused test files. Time
 * series are never cut.
 */
export const limitReport = (report: Report, limit: number): Report =>
  limit === 0
    ? report
    : {
        ...report,
        contributors: report.contributors.slice(0, limit),
        knowledge: {
          ...report.knowledge,
          directories: report.knowledge.directories.slice(0, limit),
          territories: {
            ...report.knowledge.territories,
            territories: limitTerritories(
              report.knowledge.territories.territories,
              limit,
            ),
          },
        },
        ...(report.deepDives === undefined
          ? {}
          : { deepDives: limitDeepDives(report.deepDives, limit) }),
        ...(report.pullRequests === undefined
          ? {}
          : {
              pullRequests: {
                ...report.pullRequests,
                authors: report.pullRequests.authors.slice(0, limit),
                reviewers: report.pullRequests.reviewers.slice(0, limit),
              },
            }),
      };

// Owns the `deepDives.typescript` section and the territories' figures: the coverage of the analysis, counted from the verdicts, and the blocks aggregated over the parsed files.
// Both come from the same parsed files, so a territory's figures and the repository's are measured alike.

import type {
  SkipReason,
  TypeScriptDeepDive,
} from "../report/typescript-deep-dive.js";
import { achievementsOf } from "./achievements/achievements-of.js";
import { ecosystemOf } from "./ecosystem/ecosystem-report.js";
import { complexityAndChangeOf } from "./functions/complexity-and-change.js";
import { functionsReportOf } from "./functions/function-report.js";
import type { TypeScriptFacts } from "./gather-typescript.js";
import { idiomsOf } from "./idioms/idiom-report.js";
import { aliasesByFile } from "./imports/aliases-by-file.js";
import { importAnalysisOf } from "./imports/imports-analysis.js";
import type { ImportAnalysis } from "./imports/imports-analysis.js";
import { markersReportOf } from "./markers/marker-report.js";
import { modulesOf } from "./modules/module-report.js";
import { parsedFilesOf } from "./parsed-file.js";
import { territoryTypeScriptOf } from "./territory-typescript.js";
import { testsOf } from "./tests/test-report.js";
import { strictnessOf } from "./tsconfig/strictness.js";
import { typeSafetyOf } from "./type-safety/type-safety-report.js";

type Skipped = TypeScriptDeepDive["coverage"]["skipped"];

const skippedByReason = (files: TypeScriptFacts["files"]): Skipped => {
  const counts = new Map<SkipReason, number>();
  for (const { result } of files) {
    if (result.kind === "skipped") {
      counts.set(result.reason, (counts.get(result.reason) ?? 0) + 1);
    }
  }
  return Object.fromEntries(counts);
};

const coverageOf = ({
  status,
  declarationFiles,
  files,
}: TypeScriptFacts): TypeScriptDeepDive["coverage"] => ({
  files: files.length + declarationFiles.length,
  parsed: files.filter(({ result }) => result.kind === "parsed").length,
  declarationFiles: declarationFiles.length,
  skipped: skippedByReason(files),
  parser: {
    name: status.name,
    version: status.kind === "ready" ? status.version : null,
  },
  ...(status.kind === "unavailable" ? { unavailable: status.reason } : {}),
});

/** The deep dive and what each territory carries of it. */
export type TypeScriptAnalysis = {
  readonly section: TypeScriptDeepDive;
  /** The import graph, whose figures name territories and so are drawn up with them; undefined when no file was parsed. */
  readonly imports: ImportAnalysis | undefined;
  /** The figures of the parsed files at `paths`, a territory's; undefined when there are none. */
  readonly forPaths: (
    paths: ReadonlyArray<string>,
  ) => ReturnType<typeof territoryTypeScriptOf>;
};

/**
 * The section for the universe's TypeScript and JavaScript files, with
 * `files` equal to parsed, declaration and skipped files together, and the
 * blocks over the parsed files, which are absent when there are none.
 * `revisions` are the commits per path in its current life, which
 * `complexityAndChange` joins to the functions; `shallow` says the history
 * is a shallow clone. `history` is absent where the trends were not read; with it
 * the section also judges the achievements that need them.
 */
export const typescriptAnalysis = (
  facts: TypeScriptFacts,
  revisions: ReadonlyMap<string, number>,
  shallow: boolean,
  history?: Parameters<typeof achievementsOf>[2],
): TypeScriptAnalysis => {
  const parsed = parsedFilesOf(facts.files);
  const byPath = new Map(parsed.map((file) => [file.path, file]));
  const strictness = strictnessOf(facts.project, [
    ...facts.declarationFiles,
    ...facts.files.map(({ path }) => path),
  ]);
  const hasFacts = parsed.length > 0;
  const ecosystem = ecosystemOf(parsed, facts.manifests);
  const changed = complexityAndChangeOf(parsed, revisions, shallow);
  return {
    imports: hasFacts
      ? importAnalysisOf({
          paths: [
            ...facts.declarationFiles,
            ...facts.files.map(({ path }) => path),
          ],
          parsed,
          manifests: facts.manifests,
          aliasesFor: aliasesByFile(
            facts.project.configs,
            strictness.governingConfigOf,
          ),
        })
      : undefined,
    section: {
      coverage: coverageOf(facts),
      ...(hasFacts
        ? {
            typeSafety: typeSafetyOf(parsed),
            strictness: strictness.section,
            modules: modulesOf(parsed, facts.manifests),
            idioms: idiomsOf(parsed),
            ecosystem,
            functions: functionsReportOf(parsed),
            ...(changed === undefined ? {} : { complexityAndChange: changed }),
            tests: testsOf(parsed, ecosystem),
            markers: markersReportOf(parsed),
            ...achievementsOf(parsed, strictness.section, history),
          }
        : {}),
    },
    forPaths: (paths) =>
      territoryTypeScriptOf(
        paths.flatMap((path) => byPath.get(path) ?? []),
        strictness.strictOf(paths),
        strictness.indexedAccessOf(paths),
      ),
  };
};

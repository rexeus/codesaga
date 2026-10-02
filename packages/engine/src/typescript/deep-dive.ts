// Owns the `deepDives.typescript` section and the territories' figures: the coverage of the analysis, counted from the verdicts, and the blocks aggregated over the parsed files.
// Both come from the same parsed files, so a territory's figures and the repository's are measured alike.

import type {
  SkipReason,
  TypeScriptDeepDive,
} from "../report/typescript-deep-dive.js";
import type { TerritoryTypeScript } from "../report/typescript-territory.js";
import type { TypeScriptFacts } from "./gather-typescript.js";
import { parsedFilesOf } from "./parsed-file.js";
import { territoryTypeScriptOf } from "./territory-typescript.js";
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
  /** The figures of the parsed files at `paths`, a territory's; undefined when there are none. */
  readonly forPaths: (
    paths: ReadonlyArray<string>,
  ) => TerritoryTypeScript | undefined;
};

/**
 * The section for the universe's TypeScript and JavaScript files, with
 * `files` equal to parsed, declaration and skipped files together, and the
 * blocks over the parsed files, which are absent when there are none.
 */
export const typescriptAnalysis = (
  facts: TypeScriptFacts,
): TypeScriptAnalysis => {
  const parsed = parsedFilesOf(facts.files);
  const byPath = new Map(parsed.map((file) => [file.path, file]));
  const hasFacts = parsed.length > 0;
  return {
    section: {
      coverage: coverageOf(facts),
      ...(hasFacts ? { typeSafety: typeSafetyOf(parsed) } : {}),
    },
    forPaths: (paths) =>
      territoryTypeScriptOf(paths.flatMap((path) => byPath.get(path) ?? [])),
  };
};

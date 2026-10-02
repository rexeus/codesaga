// Owns the `deepDives.typescript` section: the coverage of the analysis, counted from the verdicts.

import type {
  SkipReason,
  TypeScriptDeepDive,
} from "../report/typescript-deep-dive.js";
import type { TypeScriptFacts } from "./gather-typescript.js";

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

/** The section for the universe's TypeScript and JavaScript files, with `files` equal to parsed, declaration and skipped files together. */
export const typescriptDeepDive = ({
  status,
  declarationFiles,
  files,
}: TypeScriptFacts): TypeScriptDeepDive => ({
  coverage: {
    files: files.length + declarationFiles.length,
    parsed: files.filter(({ result }) => result.kind === "parsed").length,
    declarationFiles: declarationFiles.length,
    skipped: skippedByReason(files),
    parser: {
      name: status.name,
      version: status.kind === "ready" ? status.version : null,
    },
    ...(status.kind === "unavailable" ? { unavailable: status.reason } : {}),
  },
});

// Owns the `inspect` entry point: who knows the code behind some paths, and how much agents worked on it.
// It runs its own analysis through the shared gathering, because per-file expertise is not part of the report.

import { Effect } from "effect";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import { gatherFacts } from "../analyze/gather.js";
import type { AnalyzeError, AnalyzeOptions } from "../analyze/gather.js";
import type { InspectResult } from "../report/inspect-result.js";
import { gatherInspectedTypeScript } from "../typescript/inspect/gather-inspected.js";
import type { TypeScriptParser } from "../typescript/typescript-parser.js";
import { buildInspectResult } from "./build-inspect.js";
import { pathsMatching } from "./match-paths.js";

/**
 * Answers, for every pattern, who knows the files it matches and whether they
 * are still around. A pattern is an exact file, a directory (every file below
 * it) or a glob against repository-relative paths, `dot: true`; it yields one
 * entry aggregated over its files. Patterns that match no universe file come
 * back in `unmatched`. Expertise covers the whole history; commits and
 * automation cover the `since` window.
 *
 * An entry that matches TypeScript or JavaScript files also carries what the
 * deep dive says of them, and who imports and tests them: only those files
 * and the files that may import them are parsed.
 *
 * Fails like `analyze`.
 */
export const inspect = (
  options: Omit<AnalyzeOptions, "compare" | "detail"> & {
    readonly patterns: ReadonlyArray<string>;
  },
): Effect.Effect<
  InspectResult,
  AnalyzeError,
  | ChildProcessSpawner.ChildProcessSpawner
  | FileSystem.FileSystem
  | Path.Path
  | TypeScriptParser
> =>
  Effect.gen(function* () {
    const facts = yield* gatherFacts(options);
    const paths = facts.universe.map(({ path }) => path);
    const typescript = yield* gatherInspectedTypeScript(
      facts.root,
      facts.universe,
      facts.projectFiles,
      options.patterns.flatMap((pattern) => pathsMatching(pattern, paths)),
    );
    return buildInspectResult(facts, options.patterns, typescript);
  });

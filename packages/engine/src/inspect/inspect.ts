// Owns the `inspect` entry point: who knows the code behind some paths, and how much agents worked on it.
// It runs its own analysis through the shared gathering, because per-file expertise is not part of the report.

import { Effect } from "effect";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import { gatherFacts } from "../analyze/gather.js";
import type { AnalyzeError, AnalyzeOptions } from "../analyze/gather.js";
import type { InspectResult } from "../report/inspect-result.js";
import { buildInspectResult } from "./build-inspect.js";

/**
 * Answers, for every pattern, who knows the files it matches and whether they
 * are still around. A pattern is an exact file, a directory (every file below
 * it) or a glob against repository-relative paths, `dot: true`; it yields one
 * entry aggregated over its files. Patterns that match no universe file come
 * back in `unmatched`. Expertise covers the whole history; commits and
 * automation cover the `since` window.
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
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> =>
  Effect.map(gatherFacts(options), (facts) =>
    buildInspectResult(facts, options.patterns),
  );

// Owns the one entry point that turns a repository into a Report.
// It composes the gathered facts and the sections; callers never see git or parsers.
// New signals join here as new Report fields, not as new entry points.

import { Effect } from "effect";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import type { Report } from "../report/report.js";
import { gatherTypeScript } from "../typescript/gather-typescript.js";
import type { TypeScriptParser } from "../typescript/typescript-parser.js";
import { buildReport } from "./build-report.js";
import { gatherFacts } from "./gather.js";
import type { AnalyzeError, AnalyzeOptions } from "./gather.js";

/**
 * Analyzes the git repository containing `options.cwd` from one pass over its
 * whole history, and reports every contributor and every week and month of
 * the window; output limits belong to the caller.
 *
 * The report gains `deepDives.typescript` when the universe has TypeScript or
 * JavaScript files; a parser that did not load degrades it to its coverage.
 *
 * Fails with `NotAGitRepository`, `GitNotFound`, or `GitCommandFailed` when
 * git cannot answer, and with `InvalidSince` for a `since` that is neither
 * relative nor an ISO date in the past, and with `InvalidCompare` for a
 * `compare` that is not a relative duration or comes with `since`.
 */
export const analyze = (
  options: AnalyzeOptions,
): Effect.Effect<
  Report,
  AnalyzeError,
  | ChildProcessSpawner.ChildProcessSpawner
  | FileSystem.FileSystem
  | Path.Path
  | TypeScriptParser
> =>
  Effect.gen(function* () {
    const facts = yield* gatherFacts(options);
    const typescript = yield* gatherTypeScript(
      facts.root,
      facts.universe,
      facts.tracked,
    );
    return buildReport({ ...facts, typescript });
  });

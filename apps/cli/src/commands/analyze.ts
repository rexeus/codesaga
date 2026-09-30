import { analyze } from "@codesaga/engine";
import type { AnalyzeOptions } from "@codesaga/engine";
import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";

import { limitReport } from "../output/limit-report.js";
import { printResult } from "../output/print-result.js";
import { warnIfShallow } from "../output/shallow-warning.js";
import { renderAnalysis } from "../output/terminal/analysis-view.js";
import { version } from "../version.js";
import { WorkingDirectory } from "../working-directory.js";
import { resolveAnalysisTarget } from "./analysis-target.js";
import { jsonFlag, sinceFlag } from "./shared-flags.js";

const DEFAULT_LIMIT = 25;

export const analyzeCommand = Command.make(
  "analyze",
  {
    path: Argument.String("path").pipe(
      Argument.withDescription(
        "Directory or file inside the repository; only commits that change files under it count (default: the whole repository)",
      ),
      Argument.optional,
    ),
    json: jsonFlag,
    since: sinceFlag,
    include: Flag.String("include").pipe(
      Flag.withDescription(
        "Glob of files that count as code instead of the language list; repeatable",
      ),
      Flag.atLeast(0),
    ),
    exclude: Flag.String("exclude").pipe(
      Flag.withDescription(
        "Glob of files that do not count as code; repeatable",
      ),
      Flag.atLeast(0),
    ),
    limit: Flag.Int("limit").pipe(
      Flag.withDescription(
        `Contributors to report in --json; 0 for no limit (default ${DEFAULT_LIMIT})`,
      ),
      Flag.withDefault(DEFAULT_LIMIT),
      Flag.filter(
        (limit) => limit >= 0,
        (limit) => `--limit must be 0 or greater, got ${limit}`,
      ),
    ),
  },
  Effect.fn(function* ({ path, json, since, include, exclude, limit }) {
    const cwd = yield* WorkingDirectory;
    // A path argument both locates the repository and narrows the scope,
    // so `codesaga analyze ../other-repo` works from anywhere.
    const target = yield* resolveAnalysisTarget(cwd, path);
    const options: AnalyzeOptions = {
      ...target,
      since: Option.getOrUndefined(since),
      include,
      exclude,
      toolVersion: version,
    };
    const report = yield* analyze(options);
    yield* warnIfShallow(report);
    // --limit bounds the JSON document; the terminal view picks its own top entries.
    return yield* printResult(
      json ? limitReport(report, limit) : report,
      json,
      renderAnalysis,
    );
  }),
).pipe(
  Command.withDescription(
    "Tell the story of a git repository: activity, people and automation.",
  ),
  Command.withExamples([
    {
      command: "codesaga analyze",
      description: "Summarize the current repository",
    },
    {
      command: "codesaga analyze --json --limit 10",
      description: "The full report as JSON for an agent, with 10 contributors",
    },
    {
      command: "codesaga analyze packages/api --since 6m",
      description: "One package over the last six months",
    },
  ]),
);

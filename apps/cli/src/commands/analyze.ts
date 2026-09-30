import { analyze } from "@codesaga/engine";
import type { AnalyzeOptions } from "@codesaga/engine";
import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";

import { writeHtmlReport } from "../output/html/write-html-report.js";
import { limitReport } from "../output/limit-report.js";
import { printResult } from "../output/print-result.js";
import { warnIfShallow } from "../output/shallow-warning.js";
import { renderAnalysis } from "../output/terminal/analysis-view.js";
import { version } from "../version.js";
import { WorkingDirectory } from "../working-directory.js";
import { resolveAnalysisTarget } from "./analysis-target.js";
import { jsonFlag, sinceFlag } from "./shared-flags.js";

const DEFAULT_LIMIT = 25;
const DEFAULT_HTML_FILE = "codesaga-report.html";

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
    html: Flag.Boolean("html").pipe(
      Flag.withDescription(
        "Also write the dashboard as a self-contained HTML file and open it",
      ),
      Flag.withDefault(false),
    ),
    out: Flag.String("out").pipe(
      Flag.withDescription(
        `Where --html writes the dashboard (default ${DEFAULT_HTML_FILE}); implies --html`,
      ),
      Flag.optional,
    ),
    open: Flag.Boolean("open").pipe(
      Flag.withDescription(
        "Open the dashboard in the browser; --no-open skips it",
      ),
      Flag.withDefault(true),
    ),
    limit: Flag.Int("limit").pipe(
      Flag.withDescription(
        `Contributors and knowledge directories to report in --json; 0 for no limit (default ${DEFAULT_LIMIT})`,
      ),
      Flag.withDefault(DEFAULT_LIMIT),
      Flag.filter(
        (limit) => limit >= 0,
        (limit) => `--limit must be 0 or greater, got ${limit}`,
      ),
    ),
  },
  Effect.fn(function* (flags) {
    const { path, json, since, include, exclude, limit } = flags;
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
    // The dashboard embeds the whole report: --limit bounds only the JSON document.
    if (flags.html || Option.isSome(flags.out)) {
      yield* writeHtmlReport({
        report,
        file: Option.getOrElse(flags.out, () => DEFAULT_HTML_FILE),
        cwd,
        open: flags.open,
      });
    }
    // --limit bounds the JSON document; the terminal view picks its own top entries.
    return yield* printResult(
      json ? limitReport(report, limit) : report,
      json,
      renderAnalysis,
    );
  }),
).pipe(
  Command.withDescription(
    "Tell the story of a git repository: activity, people, knowledge and automation.",
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
      command: "codesaga analyze --html",
      description: "Write the dashboard to codesaga-report.html and open it",
    },
    {
      command: "codesaga analyze packages/api --since 6m",
      description: "One package over the last six months",
    },
  ]),
);

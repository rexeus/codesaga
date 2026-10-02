// Owns the MCP tool contracts: names, parameters and result documents.
import { InspectResult, Report } from "@codesaga/engine";
import { Context, Schema } from "effect";
import { Tool, Toolkit } from "effect/ai";

import { CheckResult } from "../check/check-result.js";
import { GateLimitsConfig } from "../check/gate-limits.js";
import { DEFAULT_LIMIT } from "../output/limit-report.js";

/** A tool call that failed; the message is the line the command line would print on stderr. */
export class ToolFailed extends Schema.TaggedError<ToolFailed>()("ToolFailed", {
  message: Schema.String,
}) {}

const WINDOW =
  "<n>d, <n>w, <n>m, <n>y or an ISO date (YYYY-MM-DD); default: the whole history";

const optional = <S extends Schema.Top>(schema: S, description: string) =>
  Schema.optionalKey(schema.annotate({ description }));

const since = optional(
  Schema.String,
  `Narrow the activity to the time since: ${WINDOW}`,
);
const blame = optional(
  Schema.Boolean,
  "Also report who wrote the lines that exist today, from git blame (adds lineOwners); runs git once per file, so it is slow on large repositories. Default: the repository's .codesaga.json, else false",
);
const path = optional(
  Schema.String,
  "Directory or file inside the repository; only commits that change files under it count (default: the whole repository around the server's working directory); it must lie inside that repository",
);
const include = optional(
  Schema.Array(Schema.String),
  "Globs of files that count as code instead of the language list",
);
const exclude = optional(
  Schema.Array(Schema.String),
  "Globs of files that do not count as code",
);

// The cache in the git directory is the only thing a call writes.
const readOnlyHints = Context.make(Tool.Readonly, true).pipe(
  Context.add(Tool.Destructive, false),
  Context.add(Tool.Idempotent, true),
  Context.add(Tool.OpenWorld, false),
);

/** `codesaga analyze --json`: the story of the repository. */
const AnalyzeTool = Tool.make("analyze", {
  description:
    "Tell the story of a git repository: activity, people, knowledge and AI agent involvement. Returns the report document of `codesaga analyze --json`.",
  parameters: Schema.Struct({
    path,
    since,
    include,
    exclude,
    limit: optional(
      Schema.Natural,
      `Contributors, knowledge directories and territories (first-cut and inside each territory) to return; 0 for no limit (default ${DEFAULT_LIMIT})`,
    ),
    detail: optional(
      Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
      "Knowledge detail to start at: 1 is the packages (or top-level folders), each further detail splits more of the big territories and those whose folders have different experts; the whole territory tree is returned, this detail is knowledge.territories.detail; a detail beyond the finest one means the finest. Default: the repository's .codesaga.json, else the detail recommended for the team",
    ),
    depth: optional(
      Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
      "Deprecated alias of detail; detail wins when both are given",
    ),
    compare: optional(
      Schema.String,
      "Compare the last <n>d, <n>w, <n>m or <n>y with the span of exactly the same length before it; cannot be combined with since",
    ),
    blame,
    github: optional(
      Schema.Boolean,
      "Also read pull requests and reviews from GitHub (adds pullRequests); sends the repository name and a token (GH_TOKEN, GITHUB_TOKEN or gh auth token) to GitHub; an origin other than github.com also needs GH_HOST=<host> in the server's environment. Only this parameter turns it on; default false",
    ),
  }),
  success: Report,
  failure: ToolFailed,
})
  .annotateMerge(readOnlyHints)
  // Only `github` leaves the machine.
  .annotate(Tool.OpenWorld, true);

/** `codesaga inspect --json`: who knows a file, directory or glob. */
const InspectTool = Tool.make("inspect", {
  description:
    "Show who knows files, directories or globs and whether they are still around, before editing or picking reviewers. Returns the result document of `codesaga inspect --json`: one answer per pattern.",
  parameters: Schema.Struct({
    patterns: Schema.Array(Schema.String)
      .check(Schema.isMinLength(1))
      .annotate({
        description:
          "Repository-relative files, directories or globs; one answer per pattern",
      }),
    since,
    blame,
  }),
  success: InspectResult,
  failure: ToolFailed,
}).annotateMerge(readOnlyHints);

/** `codesaga check --json`: knowledge-risk gates. */
const CheckTool = Tool.make("check", {
  description:
    "Evaluate knowledge-risk gates: a minimum truck factor, a maximum of orphaned or island directories, a maximum agent share (0 to 1) and a minimum of active contributors. Gates left out fall back to `.codesaga.json`; at least one must be set. A failed gate is reported in the result, not as an error.",
  parameters: Schema.Struct({
    path,
    since,
    include,
    exclude,
    ...GateLimitsConfig.fields,
  }),
  success: CheckResult,
  failure: ToolFailed,
}).annotateMerge(readOnlyHints);

export const CodesagaToolkit = Toolkit.make(
  AnalyzeTool,
  InspectTool,
  CheckTool,
);

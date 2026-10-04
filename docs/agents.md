# Using codesaga from coding agents

Agents lack the one thing a teammate would know: who understands this code, and whether they are still around. `codesaga inspect` answers that in a few hundred tokens — before an agent edits code it does not know, and when it proposes reviewers.

## Snippet for AGENTS.md or CLAUDE.md

Paste this into the repository's agent instructions:

```md
## Before editing unfamiliar code, and when choosing reviewers

Run `npx codesaga inspect <path> --json` (a file, a directory, or a quoted glob) and read the entry:

- `experts` are the people who know these files best, with `share` of files and whether they are `active` (`false`: a dormant expert). Suggest active experts as reviewers.
- `island: true` means one person is the only expert on most of these files. Say so in your summary, keep the change small, and ask that person to review.
- `orphaned: true` means most files have no active expert. Nobody on the team knows this code well: read it carefully, add tests before changing behavior, and say so in your summary.
- `reasons` explains the entry in plain words; quote it when you explain your plan.
- `typescript` (only when the path matches TypeScript or JavaScript files) says how hard and how risky the code is to change: `maxComplexity` and the `hardest` functions with their line (keep a function you add below `thresholds.typescript.complexityLimit`), `escapes` and `directives` (escape hatches and `@ts-` comments already in the production files: do not add more; tests are counted apart in `testFiles`), `importedBy` (the production files that import it: read them before you change an exported name, and say so when the count is high), `testedBy` (the test files that import it: run them, and add one when it is empty) and `strict` (`false`, `mixed` or `unknown` means the compiler checks less than you assume). A test that reaches the code only through a helper does not show in `testedBy`.
```

## Choosing the call

| Question                                        | Call                                                  | Cost                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| "Who knows this code, and are they still here?" | `codesaga inspect <path> --json`                      | One entry per argument, ≤ 5 experts                                                                         |
| "Where does knowledge sit in this repository?"  | `codesaga analyze --json`                             | 25 contributors, 25 directories, 25 territories per list                                                    |
| "How much of this package did agents write?"    | `codesaga inspect packages/billing --since 3m --json` | One entry, `automation` counts                                                                              |
| "Did activity or agent use change lately?"      | `codesaga analyze --compare 3m --json`                | Full report plus a `comparison` section                                                                     |
| "Who wrote the lines that exist today?"         | `codesaga inspect <path> --json --blame`              | Adds `lineOwners`; one `git blame` per file                                                                 |
| "How fast do pull requests merge, who reviews?" | `codesaga analyze --github --json`                    | Adds `pullRequests`; needs a token, see the README                                                          |
| "How much TypeScript did codesaga read?"        | `codesaga analyze --json`                             | `deepDives.typescript.coverage`; see below                                                                  |
| "Which functions are hardest to follow?"        | `codesaga analyze --json`                             | `deepDives.typescript.functions.production.top`                                                             |
| "How hard is this file, and who imports it?"    | `codesaga inspect <path> --json`                      | `typescript` on the entry; parses the matched files and their importers (about 1.5 s on a large repository) |
| "Everything, for a dashboard or a script"       | `codesaga analyze --json --limit 0`                   | Full report                                                                                                 |

The first call in a clone reads the whole history (seconds on a repository with a few thousand commits) and caches it in `.git/codesaga` (`history-v2.json` for the log and `syntax-v1.json` for the digests of every committed TypeScript file version, 9 MB for Effect's 59,000 versions; the first call in a repository of Effect's size takes about a minute, later ones a few seconds, and the first call after an upgrade of codesaga digests again); later calls read only the commits made since, and the digests of new blobs, and take a few seconds on a repository of that size. Call `analyze` once per task, and `inspect` per path you are about to change; for TypeScript and JavaScript files it also parses the matched files and the files that may import them, which adds about half a second on a large repository for a file few others import, and up to two seconds for a file a hundred others import. `--no-cache` skips the cache. A `.codesaga.json` in the repository root supplies defaults for `--since`, `--include`, `--exclude`, `--limit` and `--detail` and can name in-house bots and agents; flags override it (see the README's Configuration section).

`--compare <duration>` (such as `3m`) makes the window the last duration and adds a `comparison` section: the figures of the window and of the span of the same length before it, and their differences. `delta.aiShare` is `null` when either span has no commits, and `previous.partial` is `true` when the previous span starts before the first commit, so it covers less history than the window.

`deepDives` carries the language analyses; today `deepDives.typescript` has `coverage`, `typeSafety` (escape hatches such as `any`, `as` and `!`, per 1,000 lines, for production code and tests apart, so prefer `satisfies`, `unknown` and type predicates where the counterparts dominate) `strictness` (per `tsconfig`: effective `strict`, `noUncheckedIndexedAccess` and the other flags, where `"unknown"` means an `extends` could not be resolved, so do not assume the default) `modules` (ESM against CommonJS files, `import type` use, `nonErasable` syntax: write imports the way the dominant side does), `idioms` (paired counts such as `interface` against object `type` or `await` against `.then(`: follow the side the code already uses), `ecosystem` (the detected `tools`, and the most imported `packages`), `functions` (cognitive complexity per function as bands, percentiles and the five hardest functions with their path and line, production and tests apart: refactor those first, and keep a new function below `thresholds.typescript.complexityLimit`), `complexityAndChange` (the revisions that landed in files whose hardest function is hard, and up to five `hotspots`: the files where a refactor pays most), `tests` (cases, `skipped` and `focused` markers with the `focusedFiles`: never leave a focused test, and read `assertions` as "no direct assertion", not as "untested") `markers` (`TODO`, `FIXME`, `HACK`, `@deprecated` and the share of documented exports: document the exports you add), `imports` (how the code imports itself: `files` has the import `cycles` by value edges, the files with the highest `fanIn` and `fanOut`, and the `unresolved` specifiers with their `share`, which says how much of the graph to trust; `territories` is the dependency map at the report's default detail with `ca`, `ce` and `instability` per territory, the `edges`, the edges `towardLessStable` and the groups of territories that import each other in `mutualImports`, which is not a file cycle: before you add an import, check that it does not point from a stable territory toward a less stable one or close a file cycle) and a compact `typescript` on every territory (`over15Share` and `maxComplexity` of its production functions, `importsCount` and `importedByCount` of the territories it imports and is imported by, and `inCycle`, a file cycle running through it and out of it; its `badges` add `type-safe`, `strict`, `complex-logic` and `in-a-cycle`, each with the evidence behind it, and `in-a-cycle` is the one to take seriously before you add an import), and `achievements` (`any-free`, `strict-throughout`, `esm-only` and `no-ts-ignore`, reached or not: a reached one is a standard to keep, so do not add an `any`, a `@ts-ignore` or a `require` where one holds, and `progress` of a locked one says how far the code is). The `stories` of the report can name a committed focused test (`focused-test`: remove it), the hardest function (`complex-core`) and the territory most others import (`core-territory`: change its exports with care). `coverage` counts the TypeScript and JavaScript files codesaga parsed (`parsed`), the declaration files it only counted, and the files it skipped by reason. It is absent for a repository without such files. Before you rely on a deep-dive figure, read the coverage: `parsed` against `files` says how much of the code it covers, and `unavailable` (a string) means the parser did not load, so every file was skipped as `parser-unavailable` and no code figure exists.

`codesaga check --json` is for gates, not for exploration: it answers whether the repository meets limits such as `--min-truck-factor 2`, with `passed` and one `reason` per gate, and exits 5 when a gate fails. Use it in CI or before a release, and `analyze` or `inspect` to learn why a gate failed.

## MCP

`codesaga mcp` serves the same analyses as typed tools over the [Model Context Protocol](https://modelcontextprotocol.io), so an agent host lists them instead of shelling out. The server speaks stdio: the host starts it and ends it by closing stdin. It analyzes the repository around the directory the host starts it in.

Claude Code:

```bash
claude mcp add codesaga -- npx codesaga mcp
```

Any other host takes the same command in its MCP configuration:

```json
{
  "mcpServers": {
    "codesaga": { "command": "npx", "args": ["codesaga", "mcp"] }
  }
}
```

| Tool      | Parameters                                                                                                                                          | Returns                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `analyze` | `path`, `since`, `include`, `exclude`, `limit` (default 25), `detail`, `compare`, `blame`, `github`                                                 | The `analyze --json` document |
| `inspect` | `patterns` (required), `since`, `blame`                                                                                                             | The `inspect --json` document |
| `check`   | `path`, `since`, `include`, `exclude`, `minTruckFactor`, `maxOrphanedDirectories`, `maxIslandDirectories`, `maxAgentShare`, `minActiveContributors` | The `check --json` document   |

The parameters are the flags of the same name (`depth` still works as a deprecated alias of `detail`), and the documents are the `--json` documents, as `structuredContent` and as JSON text. The rules of the command line carry over: a `.codesaga.json` in the repository supplies defaults, the history cache makes repeated calls fast, and a failure such as an invalid `since`, a pattern that matches nothing or `check` without gates becomes a tool error with the message the command line would print. `blame` follows `--blame`: omitted, `.codesaga.json` decides, and `false` overrides a config that turns it on. `github` is off unless the call sets `github: true`, the equivalent of `--github`; no config file can turn it on. It sends the repository name and your token to GitHub and uses the same token sources as the command line (an `origin` other than github.com also needs `GH_HOST=<host>` in the server's environment), so a host may ask before it runs `analyze` with it. `check` reads neither. `path` must lie inside the repository around the server's working directory; another repository is a tool error, and the server is started in that repository instead. A failed gate is not an error: `check` returns `passed: false` with the reasons. Stdout carries protocol messages only; diagnostics go to stderr.

Every result travels twice, as structured content and as text, and hosts cap the size of a tool result. On a large repository ask for less: pass `limit` and `since` to `analyze`, or use `inspect` for one path instead of the whole report.

## Contract

Stdout carries exactly one JSON document in `--json` mode; diagnostics go to stderr. The documents are versioned by `schemaVersion`: fields may be added in version 1, never renamed or removed. Exit codes: 0 success, 2 usage error (including an invalid `.codesaga.json`, `check` without gates or in a shallow clone, and `--github` without a token, with a rejected token, without a GitHub `origin`, or with an `origin` host that `GH_HOST` does not name), 3 not a git repository or no git, 4 `inspect` matched nothing, 5 a `check` gate failed, 1 anything else. The shapes are defined in [`packages/engine/src/report/`](../packages/engine/src/report/) and, for `check`, in [`apps/cli/src/check/check-result.ts`](../apps/cli/src/check/check-result.ts).

# Using codesaga from coding agents

Agents lack the one thing a teammate would know: who understands this code, and whether they are still around. `codesaga inspect` answers that in a few hundred tokens — before an agent edits code it does not know, and when it proposes reviewers.

## Snippet for AGENTS.md or CLAUDE.md

Paste this into the repository's agent instructions:

```md
## Before editing unfamiliar code, and when choosing reviewers

Run `npx codesaga inspect <path> --json` (a file, a directory, or a quoted glob) and read the entry:

- `experts` are the people who know these files best, with `share` of files and whether they are `active`. Suggest active experts as reviewers.
- `island: true` means one person is the only expert on most of these files. Say so in your summary, keep the change small, and ask that person to review.
- `orphaned: true` means most files have no active expert. Nobody on the team knows this code well: read it carefully, add tests before changing behavior, and say so in your summary.
- `reasons` explains the entry in plain words; quote it when you explain your plan.
```

## Choosing the call

| Question                                        | Call                                                  | Cost                                               |
| ----------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| "Who knows this code, and are they still here?" | `codesaga inspect <path> --json`                      | One entry per argument, ≤ 5 experts                |
| "Where does knowledge sit in this repository?"  | `codesaga analyze --json`                             | 25 contributors + 25 directories, default          |
| "How much of this package did agents write?"    | `codesaga inspect packages/billing --since 3m --json` | One entry, `automation` counts                     |
| "Did activity or agent use change lately?"      | `codesaga analyze --compare 3m --json`                | Full report plus a `comparison` section            |
| "Who wrote the lines that exist today?"         | `codesaga inspect <path> --json --blame`              | Adds `lineOwners`; one `git blame` per file        |
| "How fast do pull requests merge, who reviews?" | `codesaga analyze --github --json`                    | Adds `pullRequests`; needs a token, see the README |
| "Everything, for a dashboard or a script"       | `codesaga analyze --json --limit 0`                   | Full report                                        |

The first call in a clone reads the whole history (seconds on a repository with a few thousand commits) and caches it in `.git/codesaga`; later calls read only the commits made since and take well under a second. Call `analyze` once per task, and `inspect` per area you are about to change. `--no-cache` skips the cache. A `.codesaga.json` in the repository root supplies defaults for `--since`, `--include`, `--exclude` and `--limit` and can name in-house bots and agents; flags override it (see the README's Configuration section).

`--compare <duration>` (such as `3m`) makes the window the last duration and adds a `comparison` section: the figures of the window and of the span of the same length before it, and their differences. `delta.aiShare` is `null` when either span has no commits, and `previous.partial` is `true` when the previous span starts before the first commit, so it covers less history than the window.

`codesaga check --json` is for gates, not for exploration: it answers whether the repository meets limits such as `--min-truck-factor 2`, with `passed` and one `reason` per gate, and exits 5 when a gate fails. Use it in CI or before a release, and `analyze` or `inspect` to learn why a gate failed.

## Contract

Stdout carries exactly one JSON document in `--json` mode; diagnostics go to stderr. The documents are versioned by `schemaVersion`: fields may be added in version 1, never renamed or removed. Exit codes: 0 success, 2 usage error (including an invalid `.codesaga.json`, `check` without gates or in a shallow clone, and `--github` without a token, without a GitHub `origin`, or with an `origin` host that `GH_HOST` does not name), 3 not a git repository or no git, 4 `inspect` matched nothing, 5 a `check` gate failed, 1 anything else. The shapes are defined in [`packages/engine/src/report/`](../packages/engine/src/report/) and, for `check`, in [`apps/cli/src/check/check-result.ts`](../apps/cli/src/check/check-result.ts).

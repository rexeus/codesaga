# codesaga

The story of a git repository: how active it is, who built it, where the knowledge sits and whether it is still in the team, and how much of the work AI agents and bots do.

codesaga reads the local git history only. It works offline, for any host and any branch, without a token. Humans get a self-contained dashboard, agents and scripts get versioned JSON.

```bash
npx codesaga analyze                      # the story in the terminal
npx codesaga analyze --html               # the dashboard in the browser
npx codesaga analyze --json               # the full report for agents and scripts
npx codesaga inspect packages/billing     # who knows this code, and are they still here?
npx codesaga check --min-truck-factor 2   # fail CI when knowledge risk crosses a threshold
```

Requires Node.js 22.12 or newer and `git` on your PATH. Works for any language.

## What it answers

- **Activity** — commits and lines added and deleted per week, active contributors per month, and when people commit (weekday × hour, in their local time).
- **Team** — every contributor with commits, active days, first and last commit, and main folders. There is no score and no ranking by lines: counts are context, not a leaderboard.
- **Knowledge** — who is an expert on which files, the **truck factor** (how many people can leave before more than half of the code has no expert), **knowledge islands** (one person is the only expert) and **orphaned knowledge** (the experts are no longer active).
- **Automation** — how many commits bots wrote, AI agents wrote, or humans wrote with an AI agent, per month and per tool.
- **Deep dive: TypeScript** — the TypeScript and JavaScript files of the repository, read with a real parser; see _Deep dive: TypeScript_.

## The dashboard

`codesaga analyze --html` writes `codesaga-report.html` — one self-contained file, no network access — and opens it, in light and dark mode. Top to bottom:

- **Hero** — what the repository is in one sentence (language, age, commits, people), with chips for branch, HEAD, the window and the comparison.
- **Key figures** — commits, active contributors (of everyone who ever committed), lines of code with the language shares, and the truck factor, each with a sparkline or a small picture. A repository with one author in its whole history says so instead of showing team figures.
- **Stories** — notable facts the history supports, such as an anniversary, the longest streak, the share of night or weekend work, newcomers, a quiet territory, the most renamed file, the biggest cleanup, or knowledge that rests on one person. A story appears only when its fact passes a threshold, so a repository with nothing special shows none. They state events and team facts and never rank a person; see the [glossary](GLOSSARY.md).
- **Activity** — commits and lines per week, active contributors per month and when the work happens (weekday × hour), with a table view of every chart.
- **Knowledge** — the repository as non-overlapping **territories**. A **Detail** slider switches between the details of the territory tree the report carries, starting at the recommended one; each territory card shows who is an expert on how many of its files (dormant experts are hatched), its truck factor and badges. A badge wears the color of its category (_Knowledge_ green, _Code_ violet, _Activity_ amber); only _orphaned_, _knowledge island_ and _knowledge fading_ keep a warning color, and a legend names both. A card that splits names the territories inside it and opens in place to the full width: a stats band (languages, size, file length, test share, churn, complexity and style, held against the repository's figures), who knows it, its badges with their evidence, and the territories inside, each with its own stats on demand. The slider decides how deep those splits are open, and a split that opens at a deeper detail offers a link to it. _Expand all_ and _Collapse all_ open or close every card; everything works with the keyboard.
- **Stats** — the code in numbers, as facts and never a score: histograms of file length, revisions per file and indentation complexity with the median bucket highlighted and a table view each, the languages, test files and lines against the rest, the most changed files, and the style and habits (indentation, line length, comment lines, Conventional Commits, commit size).
- **Achievements** — the repository's milestones as medallions, the reached ones first with the day they were reached (or "Holds today" for a state such as a truck factor of 5), tier pips for the tiered ones, and a progress bar for each one still ahead. They count commits, people and files and never compare people.
- **Team** — a list with a row per contributor: their status (`active`, `new` or `dormant`), commits per week, main folders and up to three badges such as _tidier_, _night owl_, _pair partner_ or _steady_, with the rest counted. Filters narrow the list by status. Badges describe what a person's commits show and never rank or compare people; see the badge list under [How the numbers work](#how-the-numbers-work). Counts are context, not a ranking.
- **Bots & Agents** — who wrote the commits and the detected tools; the section only appears when the history shows a bot or an agent.

Every figure comes from the report: the dashboard measures nothing itself and only derives what it displays from the report's figures, such as shares, rounded medians and the histogram bucket that holds the median. Badges state their rule and evidence in a tooltip, and the thresholds are in the report; see the [glossary](GLOSSARY.md) for stories, badges and a contributor's `status` (`active`, `new` or `dormant`).

`--out <file>` picks the path and implies `--html`; the target must be a writable file path (not a directory) in an existing directory, which is checked before the analysis starts. `--no-open` skips the browser. The path is printed to stderr, so `--html --json` still gives a clean stdout.

## For agents

Run `inspect` before editing code you do not know, or when choosing reviewers:

```bash
npx codesaga inspect "packages/*/src/index.ts" --json
```

```jsonc
{
  "schemaVersion": 1,
  "window": {
    "since": "2026-07-12T20:28:29.000Z",
    "until": "2026-09-30T21:03:26.456Z",
    "commits": 3637,
  },
  "matches": [
    {
      "pattern": "packages/*/src/index.ts",
      "files": 3,
      "truckFactor": 1,
      "island": true,
      "orphaned": false,
      "experts": [
        {
          "name": "Dennis Wentzien",
          "email": "my+github@wentzien.net",
          "active": true,
          "lastCommitAt": "2026-09-23T19:38:59.000Z",
          "files": 3,
          "soleFiles": 3,
          "share": 1,
        },
      ],
      "commits": 74,
      "lastCommitAt": "2026-09-19T12:14:34.000Z",
      "automation": { "human": 72, "agentAssisted": 2, "agent": 0, "bot": 0 },
      "reasons": [
        "Dennis Wentzien is the only expert on 3 of 3 files",
        "3% of 74 commits in the window were co-authored by Claude Code",
      ],
    },
  ],
  "unmatched": [],
}
```

Each argument — a file, a directory, or a glob — gives one entry aggregated over the files it matches. `.` is the whole repository. [docs/agents.md](docs/agents.md) has a snippet for `AGENTS.md` / `CLAUDE.md` that makes agents use it.

## Commands

### `codesaga analyze [path]`

| Flag                                  | Default          | Meaning                                                                                                                                                                                                      |
| ------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[path]`                              | whole repository | A directory (or file) inside a repository; only changes under it count. Also works for a repository elsewhere: `codesaga analyze ../other-repo`.                                                             |
| `--since <when>`                      | whole history    | Narrows the activity sections: `<n>d`, `<n>w`, `<n>m`, `<n>y`, or `YYYY-MM-DD`. Knowledge always uses the full history.                                                                                      |
| `--compare <duration>`                | —                | `<n>d`, `<n>w`, `<n>m` or `<n>y`: the activity window becomes the last `<duration>`, and the report compares it with the span of exactly the same length right before it. Cannot be combined with `--since`. |
| `--github`                            | off              | Also reads pull requests and reviews from GitHub. See _Pull requests and reviews from GitHub_. Only this flag turns it on; `.codesaga.json` cannot.                                                          |
| `--include <glob>`                    | language list    | Replaces the built-in list of source-code extensions. Repeatable.                                                                                                                                            |
| `--exclude <glob>`                    | —                | Removes matching files. Repeatable.                                                                                                                                                                          |
| `--detail <n>`                        | recommended      | The knowledge detail to start at: 1 is the packages (or top-level folders), each further detail opens more splits. A detail beyond the finest one means the finest. See _How the numbers work_.              |
| `--limit <n>`                         | `25`             | Contributors, knowledge directories, first-cut territories and the territories inside each one in `--json`; `0` for all. `totals` and each `totalTerritories` always tell the full size.                     |
| `--no-cache`                          | cache on         | Reads `git log` instead of the history cache, and leaves the cache alone. See _How the numbers work_.                                                                                                        |
| `--blame`                             | off              | Also reports who wrote the lines that exist today, per directory, from `git blame`. Slower, see _Line ownership_. `--no-blame` overrides a config that turns it on.                                          |
| `--json`                              | off              | One JSON document on stdout; everything else goes to stderr.                                                                                                                                                 |
| `--html`, `--out <file>`, `--no-open` | off              | The dashboard, see above. It always embeds the full report.                                                                                                                                                  |

### `codesaga inspect <path-or-glob...>`

Repository-relative files, directories or globs (quote globs so the shell leaves them alone). Takes `--json`, `--since`, `--no-cache` and `--blame`. Arguments that match nothing are listed under `unmatched`.

### `codesaga check [path]`

Runs the analysis and compares it with limits you set, so CI can fail when knowledge risk crosses a threshold. `[path]`, `--since`, `--include`, `--exclude`, `--json` and `--no-cache` work as in `analyze`. At least one gate is needed; a gate is evaluated only when you set it.

| Flag                            | Config key               | Fails when                                                                                                     |
| ------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `--min-truck-factor <n>`        | `minTruckFactor`         | the repository's truck factor is below `n`                                                                     |
| `--max-orphaned <n>`            | `maxOrphanedDirectories` | more than `n` reported directories are orphaned                                                                |
| `--max-islands <n>`             | `maxIslandDirectories`   | more than `n` reported directories are knowledge islands                                                       |
| `--max-agent-share <ratio>`     | `maxAgentShare`          | agent and agent-assisted commits are more than `ratio` (0 to 1) of the window's commits, rounded to 4 decimals |
| `--min-active-contributors <n>` | `minActiveContributors`  | fewer than `n` contributors committed in the 90 days before now                                                |

The agent share is a lower bound (see _How the numbers work_), so the gate catches the agents codesaga can see. The orphaned and island counts cover the directories the report lists: those with at least 3 files, below the path. Without gates, `check` exits 2 with `no gates configured`.

```bash
npx codesaga check --min-truck-factor 2 --max-orphaned 0
```

```
✗ truck factor: 1, below the minimum of 2
✓ orphaned directories: 0, within the maximum of 0

1 of 2 gates failed
```

`--json` prints one document, versioned by `schemaVersion`, whether or not the gates passed. Each gate has a `reason` sentence; `gates` holds only the configured gates, in the order of the table:

```json
{
  "schemaVersion": 1,
  "passed": false,
  "gates": [
    {
      "name": "minTruckFactor",
      "threshold": 2,
      "actual": 1,
      "passed": false,
      "reason": "truck factor: 1, below the minimum of 2"
    }
  ]
}
```

Its shape is defined in [`apps/cli/src/check/check-result.ts`](apps/cli/src/check/check-result.ts).

### `codesaga mcp`

Serves `analyze`, `inspect` and `check` as MCP tools over stdio until stdin closes, for agent hosts that discover tools instead of running commands; see [docs/agents.md](docs/agents.md#mcp).

### Exit codes

| Code | Meaning                                                                                                                                                                                                                                                                                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Success                                                                                                                                                                                                                                                                                                                      |
| 1    | Unexpected failure (including a git command that failed, an unwritable `--out`, or a GitHub rate limit, outage or error)                                                                                                                                                                                                     |
| 2    | Usage error, such as an unknown flag, an invalid `--since` or `--compare`, `--compare` with `--since`, an invalid `.codesaga.json`, a missing path, `check` in a shallow clone, or `--github` without a token, with a token GitHub rejects, without a GitHub `origin`, or with an `origin` host that `GH_HOST` does not name |
| 3    | Not inside a git repository, or `git` is not installed                                                                                                                                                                                                                                                                       |
| 4    | `inspect` matched no file                                                                                                                                                                                                                                                                                                    |
| 5    | `check`: at least one gate failed                                                                                                                                                                                                                                                                                            |

## Configuration

A `.codesaga.json` in the repository root sets defaults for `analyze`, `inspect` and `check`, so a team does not repeat flags. The file is optional, and a flag always wins over it.

```json
{
  "include": ["src/**", "packages/*/src/**"],
  "exclude": ["**/*.generated.ts"],
  "since": "12m",
  "limit": 50,
  "detail": 2,
  "gates": { "minTruckFactor": 2, "maxOrphanedDirectories": 0 },
  "signatures": {
    "bots": [{ "name": "Acme CI", "emails": ["ci@acme.example"] }],
    "agents": [
      {
        "name": "Acme Pilot",
        "names": ["acme-pilot"],
        "emails": ["pilot@acme.example"]
      }
    ]
  }
}
```

| Key          | Same as     | Notes                                                                                                                                                    |
| ------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `include`    | `--include` | Globs relative to the repository root.                                                                                                                   |
| `exclude`    | `--exclude` | Globs relative to the repository root.                                                                                                                   |
| `since`      | `--since`   | Same syntax: `<n>d`, `<n>w`, `<n>m`, `<n>y`, or `YYYY-MM-DD`.                                                                                            |
| `limit`      | `--limit`   | A whole number, `0` for all. Only `analyze --json` uses it.                                                                                              |
| `detail`     | `--detail`  | A whole number from 1: the knowledge detail `analyze` starts at. `depth` is a deprecated alias with the same rule; `detail` wins when both are set.      |
| `blame`      | `--blame`   | `true` turns line ownership on for `analyze` and `inspect`; `--no-blame` turns it off again.                                                             |
| `gates`      | gate flags  | Limits for `check`, see _Gates in CI_. A flag overrides the config's limit for the same gate; other gates stay.                                          |
| `signatures` | — (no flag) | In-house bots and agents. Each has a `name`, reported as the tool, and `emails` and `names` that identify it: exact matches, ignoring case, no patterns. |

- **Precedence** is flag, then config, then the built-in default. `--compare` sets the window itself, so it ignores the config's `since`; only a `--since` flag conflicts with it. `--include` and `--exclude` replace the config's list; they do not add to it.
- **Signatures** extend the built-in table of [commit classes](#how-the-numbers-work) and never replace it: a person the table already knows keeps its built-in name. A `bots` entry makes the person's commits bot commits; an `agents` entry makes them agent commits, and a human commit with that person as co-author or committer agent-assisted. Matches go by author email, author name, and the emails and names in co-author trailers.
- **The file is checked strictly.** Invalid JSON, an unknown key or a wrong value ends with exit code 2 and a message that names the file and the key, such as `invalid /repo/.codesaga.json: signatures.bots[0].name: Missing key`. A signature needs at least one non-empty entry in `emails` or `names`; entries are trimmed. A config that is a directory, a broken symbolic link, unreadable, or larger than 1 MiB is rejected the same way.
- The file is read from the root of the analyzed repository, not from the directory you run codesaga in. The history cache is unaffected: it holds raw commits, and signatures classify them on every run.

## Gates in CI

`codesaga check` turns the truck factor and its neighbours into a build check. Commit the limits to `.codesaga.json` so reviewers see them change, or pass flags. The history must be complete, because codesaga reads it all: `fetch-depth: 0` is required: in a shallow clone `check` evaluates no gate and exits with code 2, because the missing history would make the numbers wrong in either direction.

```yaml
# .github/workflows/knowledge.yml
name: Knowledge
on: pull_request
jobs:
  knowledge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npx codesaga check --min-truck-factor 2
```

A failed gate ends the step with exit code 5 and prints the reasons to the job log. `--json` gives the same verdict to a script.

## Pull requests and reviews from GitHub

Git does not record pull requests. With `--github`, `analyze` also asks GitHub for the pull requests of the activity window. Without it, codesaga makes no network request at all. Only the flag turns it on, never `.codesaga.json`: a cloned repository is untrusted, and it must not decide that your token leaves your machine.

```bash
codesaga analyze --github --since 3m
```

- **What it sends.** The `owner/name` of the repository, taken from the `origin` remote, and your token, to `api.github.com`. For a GitHub Enterprise `origin` host it goes to `https://<host>/api/graphql` (on the port of an `https://` remote, such as `https://ghe.corp:8443/api/graphql`; an ssh port is not the API port, and a `*.ghe.com` host uses `https://api.<host>/graphql`), but only when you name that host in `GH_HOST` (the variable `gh` itself reads); otherwise `analyze --github` exits with code 2 and no token is sent to a host the repository chose. Nothing else leaves your machine: no commits, paths, names or file contents.
- **The token** comes from `GH_TOKEN`, then `GITHUB_TOKEN`, then `gh auth token`. For an Enterprise host the variables are `GH_ENTERPRISE_TOKEN` and `GITHUB_ENTERPRISE_TOKEN`, then `gh auth token --hostname <host>`, so a github.com token never goes to another host. Read access to the repository's pull requests is enough. Without a token, or when `origin` is missing or not `owner/name` on a host, `analyze --github` exits with code 2 before reading any history.
- **What it reads.** Pull requests created since the window started and pull requests closed since then (merged or not), at most 1,000 per search (all GitHub's search returns), 100 per request, with their first 100 reviews. The report's `pullRequests` section says when more pull requests matched than it fetched (`truncated: true`) or a pull request has more than 100 reviews (`reviewsTruncated: true`); the figures then undercount, and the terminal view and the dashboard say so.
- **The section** (`schemaVersion` stays 1): `opened` (created in the window), `merged` and `closedUnmerged` (in the window, whenever they were opened), `medianHoursToMerge` (opening to merge, over the merged ones), `medianHoursToFirstReview` (opening to the first review by someone else, over pull requests opened in the window that got one), `months` (opened and merged per month, matching `activity.months`), `authors` (`opened`, `merged`) and `reviewers` (`reviews`, `approvals`). Reviews count when submitted in the window and by someone other than the author. `--limit` cuts `authors` and `reviewers`; `pullRequests.totals` gives their full size. Pull requests are not narrowed to a `[path]` scope.
- **Bots** (`[bot]` logins) and **deleted accounts** (`ghost`) are counted in `opened`, `merged` and the medians, but never listed under `authors` or `reviewers`.
- **GitHub logins are not mapped to git identities.** A person can appear under `contributors` with an email and under `pullRequests` with a login. Counts give context, not a ranking.
- **Failures.** A rate limit ends with exit code 1 and names when it lifts; a 502 or 503 is tried once more after a second. A token GitHub rejects (401) ends with exit code 2 and names the host, since the user can fix it; missing permissions, an outage or another error end with exit code 1 and GitHub's reason. When a limit comes with `retry-after`, that wins over the reset time.

The terminal view gains a "Pull requests" block and the dashboard a "Pull requests" section, both only when the report has the data.

## Deep dive: TypeScript

A deep dive is a language analysis beyond the code stats, in the report's `deepDives` section. It exists for repositories with TypeScript or JavaScript files (`.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs`) and is absent for all others. `analyze` parses every such file of the universe at HEAD with [oxc-parser](https://oxc.rs), from the work tree, so uncommitted edits count, and `deepDives.typescript.coverage` says what the analysis rests on:

- `files` — the universe's TypeScript and JavaScript files; it equals `parsed` plus `declarationFiles` plus every count in `skipped`.
- `declarationFiles` — `.d.ts`, `.d.mts` and `.d.cts` files, which hold types only and are counted, not parsed.
- `skipped` — files that were not analyzed, by reason, only for reasons that occurred: `too-large` (over 1 MiB), `minified` (non-blank lines average over 300 characters), `too-deep` (a syntax tree deeper than the parser's stack can follow), `syntax-error` (nothing could be recovered from the file), `parser-crashed` (the file killed the parser's process, or kept it silent for 30 s plus a second per megabyte of its batch; the others of its batch are still parsed), `parser-error` (any other failure of the parser), `unreadable` and `parser-unavailable`. Hostile input is skipped and counted, never fatal.
- `parser` — the parser's `name` and `version`.

### Type safety

`deepDives.typescript.typeSafety` counts the escape hatches of the type system and their counterparts in the parsed files, read from syntax and comments without a type checker, once for `production` code and once for `tests` (told by their path, as the `well-tested` badge does), because tests use assertions and `any` on purpose. Every part states its `files` and `lines` (non-blank lines), the denominator of its rates:

- `counts` — `any` (every `any` keyword in a type), `assertions` (`as T` and `<T>x`, never `as const`), `doubleAssertions` (`as unknown as T`), `asAny`, `nonNull` (`x!`), `tsIgnore`, `tsExpectError`, `tsNocheck`, `lintDisables` (`eslint-disable*`, `oxlint-disable*`, `biome-ignore`), and the counterparts `satisfies`, `unknown` and `typePredicates`. Directives are read from the parser's comments, so one inside a string is not counted.
- `per1000` — every count per 1,000 non-blank lines.
- `escapes`, `escapesPer1000`, `filesWithEscape` and `escapeFileShare` — the sum of `any`, `assertions`, `nonNull`, the three `@ts-` directives and `lintDisables` (`as any` counts as the two holes it is; `doubleAssertions` and `asAny` are parts of those and are not added again), its rate, and the files with at least one.
- `nocheckFiles` — up to five files with a `@ts-nocheck` comment.

The figures are counts, never a score: the JSDoc types of JavaScript are not read, and `any` in a rest parameter counts like any other. Every territory carries `typescript` with its parsed `files`, their `codeLines` and `escapesPer1000` over its production lines, to hold a card against the repository.

oxc-parser is codesaga's only runtime dependency. It ships a native binding for each platform, and a native parser can crash its process on hostile input, so codesaga parses in up to four child processes (one fewer than your cores) that run the same program again; a file that kills one is found by bisecting its batch and is the only one lost. The children end with the run and write nothing to stdout. Where it or the binding cannot be loaded (an unsupported platform, or an install that left the optional binding out), `analyze` still succeeds: the section keeps its coverage, every file is skipped as `parser-unavailable`, `parser.version` is `null`, and `unavailable` gives the loader's message. `inspect` never loads the parser.

## How the numbers work

- **One pass over the history.** codesaga reads `git log` of HEAD once, following renames. Merge commits are read to keep the commit graph connected but count as nothing. A file deleted and later recreated at the same path starts a new life: knowledge credits only the file that exists today, while the activity sections still count the earlier work. Every section is computed from that.
- **History cache** — the parsed log is kept in `.git/codesaga/history-v1.json` (inside the git directory, so git never tracks it and every clone has its own). The next run reads only the commits made since; after a rebase, a force-push or a change to `.mailmap`, `mailmap.file`, `mailmap.blob`, `refs/replace/`, `info/grafts` or the shallow boundary it reads everything again. The results are the same either way. A cache that cannot be read or written is ignored. `--no-cache` skips it; `rm -rf .git/codesaga` clears it.
- **Universe** — the files that count as code: tracked by git, not ignored, not marked `linguist-generated` or `linguist-vendored`, not in `vendor/`, `node_modules/`, `dist/`, `build/` or generated folders, not binary or minified, and matching the language list or `--include`. Lines added and deleted only count for such paths, so lockfiles and vendored code do not dominate the charts.
- **Activity window** — `--since` until now; without `--since`, the whole history. With `--compare 3m` it is the last three months, and the **previous window** is the three months before: it is exactly as long as the window, to the millisecond (the window starts three calendar months back, so it may be 89 to 92 days, and the previous window has the same length), and ends where the window starts, which belongs to the window. In a repository younger than twice the duration the previous window starts before the first commit; the report flags it as `partial`, and the terminal and dashboard say so. The `comparison` section of the JSON gives both windows' commits, active contributors (people with a commit in the window), lines added and deleted, and automation counts and AI share, and their differences: `change` is window minus previous, `ratio` is `change` over the previous value, `null` when that was zero, and the AI share difference is a fraction (`0.05` is five percentage points), `null` when either window has no commits. The terminal summary and the dashboard's key figures show the differences; they are context, not a verdict. Weeks start on Monday and, like months, are in UTC. The punch card uses each author's own time zone and counts only commits by people.
- **Identities** — a person is their author email after `.mailmap`. Two emails of one person count as two people until `.mailmap` joins them; codesaga never merges by name, because names collide.
- **Active** — a contributor is active (`status` `active` or `new`, counted by `overview.contributors.active90`) with a commit in the last 90 days, and `dormant` otherwise; an expert is active, and a contributor's `active` flag is set, with a commit in the last 183 days; an expert without one is dormant.
- **Commit classes**, first match wins:
  1. **agent** — the author is an AI agent account;
  2. **bot** — the author is a known bot or any other `[bot]` account;
  3. **agent-assisted** — a human commit that carries an agent's co-author trailer, marker trailer or message line (a `Co-authored-by:` line in the body counts too, indented or not, when its address belongs to a known agent);
  4. **human** — everything else.

  Recognized agents: Claude Code, GitHub Copilot, Cursor, Codex, Jules, Devin, Aider, Amp, OpenHands, Factory, Kiro, Junie, Cline, and review suggestions accepted from Gemini Code Assist and Windsurf. Recognized bots: Dependabot, Renovate, GitHub Actions, pre-commit.ci, Sweep, and any `[bot]` account under its own name. Matching goes by email and GitHub account ID first, so a person named Claude stays a person.

  **The automation numbers are a lower bound.** Almost every tool lets users turn attribution off, and some (Gemini CLI, the Cline extension, the Windsurf editor) leave none by default. "Not detected" does not mean "written by a human".

- **Expertise** — the Degree of Expertise model (Cury et al., _Knowledge Islands_, 2024) estimates how well a person knows a file from their history with it:

  ```
  DOE = 5.28223 + 0.23173·ln(1 + lines added) + 0.36151·(created the file)
      − 0.19421·ln(1 + days since their last commit to it) − 0.28761·ln(file size)
  ```

  Days count back from the HEAD commit, so a report is reproducible for a commit. A person is an **expert** on a file when they added lines to it and their DOE is at least 0.7 of the highest DOE on it. Only people can be experts: commits by bots and agents never count, and an agent-assisted commit counts for the person who made it.

- **Line ownership (`--blame`)** — a second signal, off by default. It runs `git blame --line-porcelain -w HEAD` on every universe file, eight at a time, and counts the non-blank lines at HEAD per author, with `.mailmap` applied and whitespace-only changes ignored. Each reported directory and territory (and each `inspect` entry) then carries `lineOwners`: the lines blamed in total and the five authors with the most, each with `lines`, `share` and `kind`. `kind` is `human`, `agent` or `bot`; unlike experts, bots and agents own lines, and the `kind` says so. A file that is not at HEAD (staged only) is left out. A file whose blame fails for another reason is left out too and counted in `lineOwners.skippedFiles`, which every `lineOwners` carries; the same figure for the whole scope sits in `knowledge.lineOwners` (and for all matches of an `inspect` in its top-level `lineOwners`), and codesaga warns once on stderr (`git blame failed for N files; line owners cover the rest`). The terminal adds a "leading line owner" column and the dashboard a compact "Lines" row on each territory card, naming the authors of the most lines with their shares and tagging bots and agents.

  **Which signal when.** Expertise (DOE) answers "who knows this code?" from the whole history: it credits lines added over time, first authorship and recency, so it also remembers people whose lines were since replaced. Line ownership answers "who wrote the lines that exist today?", which is what many people mean by "who owns this". It forgets everyone whose lines are gone, and a mass rename, a code generator or a squash merge hands lines to whoever ran it; it says nothing about who understood them. Use DOE for risk (truck factor, islands, orphaned code) and for choosing reviewers, and `--blame` to check or explain it. Where the two disagree, look at that directory.

  **Cost.** DOE comes from the one cached `git log` pass. Blame is one `git` process per file, never cached, and each walks that file's history, so the time grows with files times history depth: expect seconds on a repository of a few hundred files and longer on large ones with deep history. One measurement, not a benchmark: in a single run on one machine, a repository with 435 code files and 4,300 commits took about 2.5 seconds on top of a 0.6 second cached run. Without `--blame` nothing runs and the run is as fast as before.

  **Shallow clones.** Line ownership is unreliable in a shallow clone: blame credits every line whose history was cut off to the author of the boundary commit. `analyze` and `inspect` warn on stderr (`repository.shallow` in `analyze --json`, `shallow` in `inspect --json`); run `git fetch --unshallow` before trusting `--blame` there.

- **Truck factor** — Avelino et al.'s algorithm (ICPC 2016): remove the person who is expert on the most files, again and again, until more than half of the files have no expert. The number removed is the truck factor; the report names them.
- **Badges** — `contributors[].badges` lists what a person's commits show, each with a `category` (`focus`, `craft`, `rhythm`, `collaboration` or `journey`), its rule and the numbers behind it. They describe and never rank or compare people: every threshold is absolute and in `thresholds.badges`, no badge says "more than others", and a person's badges come in category order, three of them on a card. The kinds are _all-rounder_, _specialist_ and _keeper_ (focus), _tidier_, _tester_, _documenter_ and _toolsmith_ (craft; commits that change only CI, container, manifest, lockfile or known tool configuration files such as `vite.config.ts`, never application code like `app.config.ts`), _night owl_, _early bird_ and _weekend regular_ (rhythm), _pair partner_ and _reviewer_ (collaboration), and _founder_, _long-hauler_, _explorer_, _steady_, _new here_ and _back again_ (journey). The rhythm badges read only human commits of the last year on the author's own clock, need 40 of them in 3 calendar months, and are withheld when a person's commits all say UTC while others' do not, since such clocks say nothing about the day. _Reviewer_ is reserved: it needs GitHub logins tied to identities and is not awarded yet.
- **Territories** — the repository cut into non-overlapping slices, as a tree. The first cut is the packages, found by their manifests (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `setup.py`, `pom.xml`, `build.gradle(.kts)`, `*.csproj`, `composer.json`, `Gemfile`, `mix.exs`, `deno.json(c)`), or the top-level folders where a file lies in none. A repository's own manifest makes it a package only when no package lies below it. A territory splits into its child folders when it is big (more than the smaller of 150 files and the larger of 30 files and a quarter of all files, or more than 40 % of all files) or when its folders have different main experts (a main expert is the one person who is an expert on the most files, with no tie, and on at least half of the files that have an expert; two folders differ when neither one's main expert is an expert on half of the other's files), and only when at least two folders hold 3 files or more; the folders with fewer files and the files beside them become its `other` territory ("other files"), listed last. Each split carries its `splitReason` and the `splitDetail` at which it opens. A territory with more than 40 % of the files is split at detail 1, so it is not shown whole, unless it cannot split (fewer than two child folders with 3 files or more): then it is shown whole. A detail is how many splits are open: the others are ordered by value, expertise gain first and then size, and spread over the details 2 to `maxDetail` (at most 6), so every file belongs to exactly one territory at every detail. Each territory has the truck factor, islands and orphaned flags of a directory, over all its files. The report starts at the deepest detail up to which expertise still separates folders and which shows no more territories than the team allows: two per contributor active in 90 days (every contributor if none is), between 4 and 25; `knowledge.territories.reason` says why. `--detail` and `detail` choose another start; the whole tree is in the JSON either way.
- **Code stats** — `stats` in the JSON describes the universe files at HEAD and the history behind them, and every territory of the tree, whatever its depth, carries the same shape: files and code lines, file length (minimum, median, maximum and the longest file), languages, test files by path, churn (revisions per file: median, 90th percentile, total and the most changed files), indentation complexity and style (indentation, line length, comment lines). A territory's `stats` leave out the histograms and list its three most changed files; the repository's own `stats` add them, as arrays of file counts in a fixed bucket order (file length: 1–50, 51–100, 101–200, 201–400, 401–800 and more than 800 lines; revisions: 1, 2, 3–4, 5–9, 10–19 and 20 or more; levels per line: below 0.25, 0.25 to below 0.5, 0.5 to below 1, 1 to below 1.5, 1.5 to below 2 and 2 or more), and list its five most changed files. A **revision** is a commit that changed the file in the current life of its path, following renames. **Complexity** is ported from [codeheat](https://github.com/rexeus/codeheat): a tab is one indentation level and spaces count `floor(spaces / width)`, the width (2 to 8) detected per file; a file's value is its levels per non-blank line. Comment lines are lines that start with a comment of the language's family (`//` and `/* */`, `#`, `--`, `<!-- -->`); a trailing comment leaves its line a code line, and languages without a listed syntax count none. Only the repository's `stats` adds the share of Conventional Commits and the size of a commit (lines added and deleted in code files), over the non-merge commits of the activity window. Medians and percentiles interpolate between the two closest ranks. A file without a code line counts as a file but is left out of the length and complexity distributions. The code badges `heavyweight`, `hotspot`, `churning` and `deeply-nested` compare a territory's stats with the repository's and also with the territories at the same level of the tree (at least 3 of them; `heavyweight` and `hotspot` need at least twice the fair share, `churning` and `deeply-nested` at least 1.5 times the median of those territories); their thresholds are in `thresholds.badges`. The terminal shows a short "Stats" block.
- **Achievements** — `achievements` in the JSON lists nine repository milestones, all of them always, reached or not, each with its `detail` and, while locked, its `progress` (such as 800 of 1,000 commits). A `milestone` stays reached and carries the day it was first passed in `reachedAt`, computed from the history; a `state` holds today, can be lost and has no day. They state a threshold the repository passed and never name or compare a person. A shallow clone shows what its commits show, with "at least" in the sentence but no `reachedAt`, and withholds Bus-proof and Fresh blood, which need the first commits; see the [glossary](GLOSSARY.md) for each rule. The terminal shows an "Achievements" line.
- **Directories** (deprecated, removed with `schemaVersion` 2: read the territories) — every directory with at least 3 files gets its own truck factor. A **knowledge island** has one person as the only expert on at least 80 % of its files. **Orphaned knowledge** means more than half of its files have no active expert. Directories are listed by risk: orphaned first, then islands, then by truck factor.

The report states every threshold under `thresholds`, and the JSON contract is versioned by `schemaVersion`: new fields may appear, but a field is never renamed or removed without a new version.

## Known limits

- **Expertise is an estimate from history, not a fact.** The model's constants were fitted on other projects. `--blame` adds line ownership as a second view, not as a correction.
- **Scope follows current paths.** A file moved out of `analyze <path>` takes its history with it; a file moved in brings its history along.
- **Shallow clones lack history.** `analyze` and `inspect` warn and ignore the boundary commit, and `--blame` credits the cut-off lines to its author; run `git fetch --unshallow` for full results. Partial clones (`--filter=blob:none`) make git fetch every blob during the run; use a full clone.
- **Commits dated before 1970 or in the future** are left out.
- **Forge data is GitHub only, and opt-in.** Pull requests and reviews come with `--github`; GitLab, issues and comments are not read.
- **The cache keys on the mailmap, replace refs, grafts and the shallow boundary, not on every git setting.** A change to `.gitattributes` (such as marking files `-diff`), `.git/info/attributes`, `core.attributesFile`, `diff.algorithm` or `diff.renameLimit` alters what `git log` prints for old commits without invalidating the cache; run once with `--no-cache` and clear it with `rm -rf .git/codesaga`.
- **Linked worktrees share one cache** and rewrite it when their HEADs differ.
- **The cache file grows with history**, about 1.2 KB per commit.
- **The parser is a native dependency.** An install that drops optional dependencies, such as an npm lockfile made on another platform, leaves the TypeScript deep dive without a parser; it reports why in `coverage.unavailable`. Reinstalling on the target platform fixes it.

## Contributing

See [AGENTS.md](AGENTS.md) for the workflow and rules, [TESTING.md](TESTING.md) for tests, and [docs/](docs/README.md) for everything else. `pnpm install && pnpm check` is the gate.

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
- **Stories** — notable facts the history supports, such as an anniversary, the longest streak, the share of night or weekend work, newcomers, a quiet territory, the most renamed file, the biggest cleanup, or knowledge that rests on one person; for TypeScript code also a committed focused test, the hardest function with the share of the code in functions of cognitive complexity 15 or more, and a territory that most others import (at most two of these show among the six). A story appears only when its fact passes a threshold, so a repository with nothing special shows none. They state events and team facts and never rank a person; see the [glossary](GLOSSARY.md).
- **Activity** — commits and lines per week, active contributors per month and when the work happens (weekday × hour), with a table view of every chart.
- **Knowledge** — the repository as non-overlapping **territories**. A **Detail** slider switches between the details of the territory tree the report carries, starting at the recommended one; each territory card shows who is an expert on how many of its files (dormant experts are hatched), its truck factor and badges. A badge wears the color of its category (_Knowledge_ green, _Code_ violet, _Activity_ amber); only _orphaned_, _knowledge island_, _knowledge fading_ and _in a cycle_ keep a warning color, and a legend names both. A card that splits names the territories inside it and opens in place to the full width: a stats band (languages, size, file length, test share, churn, complexity, style and, for TypeScript code, the TypeScript lines, held against the repository's figures), who knows it, its badges with their evidence, and the territories inside, each with its own stats on demand. The slider decides how deep those splits are open, and a split that opens at a deeper detail offers a link to it. _Expand all_ and _Collapse all_ open or close every card; everything works with the keyboard.
- **Stats** — the code in numbers, as facts and never a score: histograms of file length, revisions per file and indentation complexity with the median bucket highlighted and a table view each, the languages, test files and lines against the rest, the most changed files, and the style and habits (indentation, line length, comment lines, Conventional Commits, commit size).
- **Deep dive: TypeScript** — only for a repository with TypeScript or JavaScript files; the nav entry is _TypeScript_. A strip of five figures sums the code up (escape hatches per 1,000 production lines, the share of governed files that compile with `strict`, the share of functions scoring 15 or more, import cycles, test cases) above a note on how many files were read. The stories about the code (strict since, the escape trend, the module era, a focused test, the hardest function, the most imported territory) open the card as lines. Then three groups of cards, open:
  - _Type safety_ — the escape hatches of production code and of tests as 100% stacked bars, the rate per 1,000 lines and a table of every kind of site; the counterparts (`unknown`, `satisfies`, type predicates) and the overlapping `any` counts; and the compiler strictness, one bar per option (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`) over the files each `tsconfig` governs, with the configs listed beside it. A config that could not be read leaves its files _unknown_, hatched, and never counts as off. Between them a line chart with a series picker shows escape hatches and `any` per 1,000 lines, the share of complex functions, the share of ES modules and the test cases by month; it notes where the series starts when the first-parent chain it replays begins after the repository's first commit, and it can be read with the keyboard. A timeline lists when `strict` or `noUncheckedIndexedAccess` changed.
  - _Functions_ — the histograms of cognitive complexity and function length with every bar counted, the five hardest functions, and the files where hard functions meet many revisions.
  - _Imports_ — the territory map as a list of edges sorted by file pairs (the lighter part of a bar is the pairs that import only types), the afferent and efferent coupling and the instability of each territory, the groups of territories that import each other, the edges toward less stable territories, and the file graph with its most imported files and its cycles. It is a list and not a graph, so it reads at any width.

  _More facts_ are folded cards that show a one-line summary until opened: _Idioms_ (paired ways of writing the same thing as 100% bars, with no side better), _Modules and era_ (with the history of the ES module share), _Ecosystem_, _Tests_, _Markers and docs_ and _Escapes by kind of commit_ (what human, agent-assisted, agent and bot commits added and removed, never per person and a lower bound for agents). An opened card takes the full width. A parser that did not load leaves one calm note with the reason, a JavaScript-only repository gets a note instead of type figures (it has no types to escape from), and a territory card gains TypeScript lines in its stats band: escape hatches per 1,000 lines held against the repository's, `strict`, the share of ES modules, the share of hard functions, and what it imports and is imported by. Everything is a count or a rate; nothing is graded.

- **Achievements** — the repository's milestones as medallions (a Deep dive adds its own group, tagged _TypeScript_: any-free, strict throughout, ESM only, no ts-ignore, tightened), the reached ones first with the day they were reached (or "Holds today" for a state such as a truck factor of 5), tier pips for the tiered ones, and a progress bar for each one still ahead. They count commits, people and files and never compare people.
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

| Flag                                  | Default          | Meaning                                                                                                                                                                                                                                                                                                    |
| ------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[path]`                              | whole repository | A directory (or file) inside a repository; only changes under it count. Also works for a repository elsewhere: `codesaga analyze ../other-repo`.                                                                                                                                                           |
| `--since <when>`                      | whole history    | Narrows the activity sections: `<n>d`, `<n>w`, `<n>m`, `<n>y`, or `YYYY-MM-DD`. Knowledge always uses the full history.                                                                                                                                                                                    |
| `--compare <duration>`                | —                | `<n>d`, `<n>w`, `<n>m` or `<n>y`: the activity window becomes the last `<duration>`, and the report compares it with the span of exactly the same length right before it. Cannot be combined with `--since`.                                                                                               |
| `--github`                            | off              | Also reads pull requests and reviews from GitHub. See _Pull requests and reviews from GitHub_. Only this flag turns it on; `.codesaga.json` cannot.                                                                                                                                                        |
| `--include <glob>`                    | language list    | Replaces the built-in list of source-code extensions. Repeatable.                                                                                                                                                                                                                                          |
| `--exclude <glob>`                    | —                | Removes matching files. Repeatable.                                                                                                                                                                                                                                                                        |
| `--detail <n>`                        | recommended      | The knowledge detail to start at: 1 is the packages (or top-level folders), each further detail opens more splits. A detail beyond the finest one means the finest. See _How the numbers work_.                                                                                                            |
| `--limit <n>`                         | `25`             | Contributors, knowledge directories, first-cut territories and the territories inside each one in `--json`, and the lists of the TypeScript deep dive (`tsconfig` postures, hardest functions, hotspots, focused test files); `0` for all. `totals` and each `totalTerritories` always tell the full size. |
| `--no-cache`                          | cache on         | Reads `git log` instead of the history cache, and leaves the cache alone. See _How the numbers work_.                                                                                                                                                                                                      |
| `--blame`                             | off              | Also reports who wrote the lines that exist today, per directory, from `git blame`. Slower, see _Line ownership_. `--no-blame` overrides a config that turns it on.                                                                                                                                        |
| `--json`                              | off              | One JSON document on stdout; everything else goes to stderr.                                                                                                                                                                                                                                               |
| `--html`, `--out <file>`, `--no-open` | off              | The dashboard, see above. It always embeds the full report.                                                                                                                                                                                                                                                |

### `codesaga inspect <path-or-glob...>`

Repository-relative files, directories or globs (quote globs so the shell leaves them alone). Takes `--json`, `--since`, `--no-cache` and `--blame`. Arguments that match nothing are listed under `unmatched`. An entry that matches TypeScript or JavaScript files also carries `typescript`, see _Inspect_ under _Deep dive: TypeScript_.

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
- **Bots** (logins ending in `[bot]`, `-bot` or `_bot`) and **deleted accounts** (`ghost`) are counted in `opened`, `merged` and the medians, but never listed under `authors` or `reviewers`.
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

- `counts` — `any` (every `any` keyword in a type), `assertions` (`as T` and `<T>x`, never `as const`), `doubleAssertions` (`as unknown as T`), `asAny`, `nonNull` (`x!`), `tsIgnore`, `tsExpectError`, `tsNocheck`, `lintDisables` (`eslint-disable*`, `oxlint-disable*`, `biome-ignore`), the counterparts `satisfies`, `unknown` and `typePredicates`, and three that exist to count sites: `assertionChains` (an assertion and the assertions it wraps count once), `anyOutsideAssertions` and `benignAny`. Directives are read from the parser's comments, so one inside a string is not counted.
- `per1000` — every count per 1,000 non-blank lines.
- `escapes`, `escapesPer1000`, `filesWithEscape` and `escapeFileShare` — `escapes` counts _sites_, one per hole: `anyOutsideAssertions`, `assertionChains`, `nonNull`, the three `@ts-` directives and `lintDisables`. `x as any` is one escape (an assertion; its `any` belongs to it), `x as unknown as T` and `x as any as T` are one, and the `any` of a rest parameter (`...args: any[]`) and of a generic constraint (`T extends any`) is `benignAny` and not an escape. `Map<string, any>`, `let x: any` and a parameter `x: any` are escapes. The other counts describe their own kind and overlap with these, so they are not added up. `escapesPer1000` is the rate, and `filesWithEscape` the files with at least one site.
- `nocheckFiles` — up to five files with a `@ts-nocheck` comment.

The figures are counts, never a score: the JSDoc types of JavaScript are not read, and `any` in a rest parameter counts like any other. Every territory carries `typescript` with its parsed `files`, their `codeLines` and `escapesPer1000` over its production lines, to hold a card against the repository.

### Strictness

`deepDives.typescript.strictness` says what each `tsconfig*.json` makes the compiler check. The configs are read as JSON with comments and trailing commas and their `extends` followed (relative paths, arrays and `${configDir}`; a package is looked up first among the repository's own workspace packages, by the `name` in their `package.json`, with its `exports` and `tsconfig` fields, and then in `node_modules`, so a clone without an install still resolves `@repo/tsconfig/base.json`; nothing outside the repository is read, and paths in the report are the real ones, relative to the repository); the posture is the effective one, a later `extends` entry over an earlier one and a config over what it extends:

- `configs` — per file: `path`, the resolved `extends` chain, `unresolved` (the specifiers no file was found for, such as an npm preset that is not installed), the TypeScript and JavaScript `files` it governs, the effective `strict` with `strictExceptions` (parts of `strict` set the other way), `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`, `isolatedModules`, `allowJs`, `checkJs`, and `target`, `module` and `moduleResolution` as written (null when not set). An option that an unresolved config may have set is `"unknown"`, never the default: codesaga does not guess. `--limit` cuts the list; `totalConfigs` keeps its length.
- `typescript` — the version ranges declared for `typescript` in the root `package.json`, every workspace `package.json` and a pnpm catalog (`catalog:` resolved), each once, and `strictByDefault`: TypeScript 6 turned `strict` on by default, so an unset `strict` is on when every major in those ranges is 6 or later (a range such as `^5.9 || ^6.0` names both) and off when all are earlier; it is `unknown` when they differ or no version is readable.
- `governedFiles`, `ungovernedFiles` and `jsFilesOutsideConfigs` — which files a config governs: among the configs whose `include`, `files` and `exclude` select a file, the deepest directory wins, then `tsconfig.json` over `tsconfig.build.json` and the like. A config without `include` and `files` covers its directory tree, as in TypeScript, so a root `tsconfig.json` that child configs extend still governs the files they do not claim. Only a config that is extended and is not named `tsconfig.json` (such as `tsconfig.base.json`), with no `include` or `files`, is a pure base and governs nothing. A JavaScript file is governed only by a config with both `allowJs` and `checkJs`. `ungovernedFiles` counts TypeScript files (declaration files included) that no config governs; JavaScript files that none governs are not a gap and are counted apart, in `jsFilesOutsideConfigs`. The three add up to `coverage.files`. A repository without a `tsconfig` has an empty `configs`.

Every territory's `typescript.strict` is `true` or `false` when the configs that govern its files agree, `mixed` when they do not and `unknown` when a config could not be read; it is absent when no config governs one of its files. Only `tsconfig*.json` files inside the analyzed scope are listed, and a config that cannot be parsed is left out. Manifests and configs are the project's own: the universe's exclusions apply to them (vendored, generated, `dist`, `build` and `node_modules` directories, `linguist-vendored` and `linguist-generated` files), and so do samples, so nothing under `example`, `examples`, `template`, `templates`, `fixtures` or `__fixtures__` counts toward the strictness and ecosystem blocks.

### Modules, idioms and ecosystem

`deepDives.typescript.modules` counts the module systems of the parsed files, tests included (each count states its denominator, `files`): `esmFiles` (files with an `import` or `export` declaration or `import.meta`), `commonjsFiles` (`require` calls, `module.exports` and `exports.x` assignments, `import x = require()` and `export =`), counted only where the name is not bound in the file, so `const require = createRequire(import.meta.url)` or a function that takes `exports` as a parameter does not make a file CommonJS and `bothFiles`; `imports.declarations` against `imports.typeOnly` (declarations that bind only types, with `import type` or a `type` marker on every binding); `nonErasable`, the files and uses of what Node's type stripping cannot erase (enums, runtime namespaces, parameter properties, decorators); and `packageTypes`, the `package.json` files by their `type`. Every territory's `typescript.esmShare` is its ESM files over those and its CommonJS files.

`deepDives.typescript.idioms` is a set of paired counts for the production code, tests left out: `interface` against object `type`, `enum` against a union of string literals, top-level classes against functions against `const` arrows, `await` against `.then(`, `#private` against `private`, default against named exports, `const`, `let` and `var`, `for...of` against `.forEach(`, mutating calls (`push`, `sort`, `splice` and the like) against transforming calls and spreads, and `?.` and `??`. A pair's sum is its denominator. They are counts of syntax, never labels: the section does not call code functional or object-oriented, and no study says which side of a pair is better. Calls are counted by method name, since no types are known, so the mutation and transformation lists skip calls on a PascalCase name (`Effect.map`, `Arr.filter`) and on strings, and leave out `slice` and `concat`, which strings have too; exports are counted at the top level of a file, not inside a `namespace`.

`deepDives.typescript.ecosystem` names the stack from a curated table (`packages/engine/src/typescript/ecosystem/ecosystem-table.ts`: React, Next.js, Vue, Svelte, Angular, Solid, Express, Fastify, Hono, Koa, NestJS, tRPC, Prisma, Drizzle, Effect, fp-ts, RxJS, zod, valibot, Vitest, Jest, Mocha, node:test, bun:test, Playwright, Cypress, ESLint, oxlint, Biome, Prettier, oxfmt, Vite, webpack, esbuild, tsup, tsdown, Turborepo, Nx): `tools` lists those the code imports (`files` importing it) or a `package.json` declares (`declaredIn`; the files of tests and workspace links are left out); `packages` and `nodeBuiltins` the ten most imported, by importing files, where a bare specifier is a package only when a `package.json` declares it (any section) or it names a workspace package, so path aliases such as `src` or `@app/foo` are not listed and are counted in `undeclared` (distinct names), and a bare `events` or `buffer` is a built-in only when no manifest declares it (a `node:` specifier always is one); `dependencies` the distinct runtime and dev dependency names; and `hooks` the calls of functions named `use` plus a capital, such as React hooks. A tool missing from the table is absent, not unused.

### Functions, tests and debt markers

`deepDives.typescript.functions` describes the functions of the parsed files, once for `production` code and once for `tests`. Each part states its `files`, `codeLines` and `functions`, the denominators of its shares, and scores every function with _cognitive complexity_ as the [SonarSource whitepaper](https://www.sonarsource.com/docs/CognitiveComplexity.pdf) (v1.7) defines it: an `if`, a ternary, a `switch` (once for all its cases), a loop and a `catch` add 1 plus their nesting level, `else if` and `else` add 1, a run of like `&&` or `||` operators adds 1 (a change of operator starts a new run), a jump to a label adds 1, and a function that calls itself by its own name adds 1. `??`, `?.`, `try`, `return` and `await` add nothing, and recursion is found only for a direct call by name (`f()`, or `this.m()` in a method), not for an indirect cycle, and not for a call of a name that a parameter, a local or an inner function declares anew. Module-level statements belong to no function and are not scored, as in Sonar.

- **What a function is.** Every function is scored, callbacks and nested functions included, from its own body only: the structures of a function nested in another count for the nested one, and the function around it adds nothing for it and no nesting, the way `eslint-plugin-sonarjs` reports each function. So `Effect.gen(function* () { ... })` and the callbacks inside it are separate functions, a `describe` callback scores what its own statements add, and React components score what their JSX conditionals and handlers add; they are not treated apart. A function's `lines` include the functions nested in it, and the lines inside functions of 15 or more count a nested one once.
- `complexity` — `bands` (functions with a score of 0–4, 5–9, 10–14, 15–24 and 25 or more, in that order), `p50` and `p90` (interpolated between ranks over every score) and `max`.
- `over15` — the functions at or above Sonar's default limit of 15, with their `share` of `functions`, and the non-blank `lines` inside them with their `lineShare` of `codeLines`, so a few big functions show as the share of the code they hold.
- `top` — the five hardest functions with `name`, `path`, `line`, `complexity` and `lines`. A name comes from what binds the function (`const f = ...`, `Class.method`, an object key, `default`); a function nothing binds is `(anonymous)`, after the function around it as in `make > (anonymous)`.
- `lengths` (functions with 1–15, 16–30, 31–60 and 61 or more non-blank lines, as the Software Improvement Group's guidance bands them), `longParameterLists` (more than 4 parameters, a destructured one counting once) and `maxDepth` (the deepest nesting of control structures).

The score differs from `eslint-plugin-sonarjs` (S3776) in two ways, both on purpose: it counts `||` runs, which the whitepaper counts and the plugin leaves out, and a function that calls itself by its own name (also from a callback inside it) gets 1 more, which the plugin does not look for. Measured on every function of codesaga, Express, zustand and Effect, the scores are equal for 86% of the functions the plugin reports, and every other one differs by those two rules or by a quirk of the plugin, which lets a function that is directly a branch of a ternary raise the nesting of the enclosing function's later structures. A function that this repository's lint accepts at 15 can therefore score more here. Cognitive complexity correlates with comprehension time and with how understandable people rate code, with mixed results for correctness (Muñoz Barón, Wyrich and Wagner, ESEM 2020); the bands are named in `thresholds.typescript` and are bands for reading a distribution, not targets. Every territory's `typescript` carries `over15Share` and `maxComplexity` for its production functions.

`deepDives.typescript.complexityAndChange` joins the hardest function of each production file to the file's revisions: `complexRevisionShare` is the share of all revisions of those files (`revisions`) that landed in the `complexFiles` whose hardest function scores 15 or more, and `hotspots` lists up to five files at or above the 90th percentile of both the hardest-function scores and the revisions, with a hardest function of at least 10 and at least 2 revisions (`thresholds.typescript`). A file's complexity is its hardest function's, so a long file of easy functions does not stand out. In a shallow clone the revisions are those of the visible history only, and the block says so with `shallow: true`. It is one line about hotspots on purpose; [codeheat](https://github.com/rexeus/codeheat) is where they are explored.

`deepDives.typescript.tests` reads the test files (by path, as above): `cases` (any member chain rooted at `it`, `test` or Mocha's `specify` that ends in a call with a title and a function: `it.effect`, `it.live`, `it.prop`, `it.effect.each(table)(...)` and the `skip`, `only`, `todo` and `fixme` forms anywhere in the chain, an `each` table counted once and again in `parameterized`; `it.layer(...)(...)` and `describe` and `context` are suites, and `test.step` and hooks are no case), `skipped` (`skip`, `xit`, `xtest`, `xdescribe`), `focused` (`only`, `fit`, `fdescribe`; a runner skips every other test while one is committed) and `todo`, where a marked `describe` counts once as the marker it is, `focusedFiles` (up to five) with `focusedFileCount` (all of them), `snapshots` and `typeTests` (`expectTypeOf`, `assertType`), and the `frameworks` the ecosystem detected. A pending case, a title without a function as Mocha writes it, is a `todo`. `assertions` bands the cases that have a body by their direct assertions, 0, 1, 2 to 3 and 4 or more: `expect(...)`, `expect.soft`, `expect.poll`, `assert(...)`, `assert.x(...)`, `assertX(...)` and `strictEqual(...)` helpers called by name, and a member named `expect`, as in supertest, inside the case's own callback. A case that asserts in a helper it calls shows as 0, which says "no direct assertion" and not "untested", and no study ties assertions per test to quality. Cases are found by the call shapes of Jest, Vitest, Mocha, node:test, Bun and Playwright without resolving imports, so a runner with other names is not seen, and a loop around `it` counts once.

`deepDives.typescript.markers` counts, in production code, the comment lines that begin with `TODO`, `FIXME`, `HACK` or `XXX` (after the characters that decorate a comment, and not inside a string), the comments with an `@deprecated` tag at the start of a line (prose that mentions it does not count), and the exported declarations (`export` followed by a declaration, and `export default`; re-exports are not) with a JSDoc block directly before them as `documentedShare`: the gap is measured from the first decorator, line comments such as `// eslint-disable-next-line` between the block and the declaration are looked through, an overloaded function is one declaration, documented when one of its signatures is, and a license header is not documentation. CommonJS exports are not counted.

`deepDives.typescript.trends` replays the whole history. `analyze` reads the first-parent chain of HEAD (`git log --first-parent --diff-merges=first-parent --no-renames`: a merge shows what it brought in, a rename is a deletion and an addition, and replaying the chain ends in exactly HEAD's committed tree) and digests every version of every TypeScript and JavaScript file that the universe's path rules count (not `dist/`, vendored, generated, minified or git-ignored files, and nothing `--exclude` leaves out), once, with the same parser as above. A digest is the few counts the history keeps of a file version, not its full facts: non-blank lines, `any`, escape sites, suppressions, functions with their complexity, the module systems, test cases, declarations and exported functions. Digests are kept by blob id and parse options (`.ts` and `.tsx` differ) in `.git/codesaga/syntax-v1.json`, so the next run digests only blobs it has not seen. On the first run in a repository of Effect's size (11,000 commits, 59,000 file versions) that costs about 100 seconds on four parse processes on a shared machine, and a terminal's stderr shows `Reading TypeScript history: 12,345 / 57,923 file versions` meanwhile; nothing is printed when stderr is not a terminal, and never anything on stdout. The first run after an upgrade of codesaga does it again, because the tool's version is part of what a cached digest was made under. `check` reads no history and skips all of this. The block holds:

- `months` and `series` — a point per month, from the month of the earliest dated commit to the current one, in arrays aligned with `months`: `production.*` and `tests.*` for `files`, `lines` (non-blank lines, the denominator of `typeSafety`'s rates), `any` (explicit `any` keywords), `escapes` (escape sites, counted as in `typeSafety`), `suppressions` (`@ts-` directives and lint disables), `functions`, `complexFunctions` (cognitive complexity of 15 or more), `esmFiles` and `commonjsFiles` (tooling configs such as `jest.config.js` are left out of these two, since they are CommonJS by convention), and `tests.testCases` and `tests.focusedTests`. A month's point is the state of the chain after the last commit dated in that month or before it, so a commit dated earlier than the ones before it (clock skew, a rebase) counts from its own month on, together with everything before it in the chain; a commit without a readable date, or dated in the future, is in no month. A month without a commit repeats the one before. The last point is HEAD's committed tree, not uncommitted edits, so it can differ from the report's figures about the work tree. Each file is known by the path it had at that time, and production and tests are told apart by that path. In a shallow clone the chain starts at the boundary commit, which adds the tree the clone was cut at, so the series start in its month.
- `events` — the 20 newest changes of `strict` and `noUncheckedIndexedAccess` in a `tsconfig*.json`, oldest first, found by the same replay and as each config effectively sets the flag over the configs it extends, resolved against the files that existed at that commit, so a renamed base config is followed: `date`, `path` (the name the config had then), `flag`, `from` (null when the commit created the config) and `to`. A flip in a base config shows on every config that extends it. Only a change between two values written in the config or the configs it extends is an event: a flag that is no longer set (a removed key, a root that became a solution-style config of references) or that a config which cannot be read, such as an npm preset, may decide is not reported as turned off, and a new config is reported only where it is the first to switch a flag on.
- `escapesByAutomation` — the escape sites that the commits of the activity window added and removed, for `human`, `agent-assisted`, `agent` and `bot` commits, beside the commits of that class that changed a TypeScript or JavaScript file. A commit's figure is the net change over its files, so a move between files cancels out. A commit without a marker counts as human, so the agent share is a lower bound; one study of 814 TypeScript pull requests found agents adding about nine times more `any` than people (Lee, Hassan and Hindle 2026, arXiv 2602.17955; regex-based, small), and these counts let a repository look at its own history. They are descriptive: a class is detected only where a commit says so. They are shown per class, never per person.

`--limit` cuts `functions.*.top`, `complexityAndChange.hotspots` and `tests.focusedFiles` like the other lists.

### Imports

`deepDives.typescript.imports` says how the code depends on itself. Every module request with a constant specifier (`import`, `export ... from`, `import("x")`, `require("x")`, `import x = require()`, a template literal without expressions included) is resolved against the universe's TypeScript and JavaScript files without touching the file system:

- relative paths, with `.js`, `.mjs` and `.cjs` read as their `.ts`, `.mts` and `.cts` sources, extensionless files, a directory's own `package.json` `types`, `module` or `main`, and `index` files;
- the `paths` and `baseUrl` of the config that governs the file, or of the nearest config above it for a file no `include` selects (a script, a test, an excluded folder);
- `#` imports through the `imports` field of the nearest `package.json`, with the conditions below;
- the repository's own workspace packages, through `exports` (following the `types`, `import` and `default` conditions, subpath maps and `*` patterns), `types`, `module` and `main`, with `src` and the package directory tried where a manifest points at build output that a checkout does not hold. When two manifests share a name the one with the shortest path wins.

A name that points into the repository and finds no file is `unresolved`, never guessed; a bare name that nothing in the repository claims is `external` and counted, not resolved; a style sheet, image, JSON or other data file (`.css`, `.json`, `.svg`, `.vue`, `.yaml`, `.wasm`, `.graphql`, ...) is an `asset`. `import()` and `require()` calls with a computed argument are counted as `dynamicUnresolvable`.

`imports.files` describes the graph of files, with one edge per pair where one imports the other and test files as nodes that take part in no figure but `edges.tests`:

- `unresolved` — `count`, `share` (over the specifiers that point into the repository, resolved or not) and the five `top` specifiers by the number of files that name them. Files that are git-ignored or generated are not in the universe, so imports of them are unresolved.
- `cycles` — an _import cycle_ is a set of production files that all reach each other by imports, or a file that imports itself. `count`, `largest` and the three largest in `top` (up to ten files each, listed sorted by path and not in the order of the cycle, and the `territories` they lie in) follow value edges only, since an `import type` is erased and costs nothing at runtime; `withTypes` gives the same count and largest size when type-only edges count too, and `typeOnly` counts the cycles that exist only through them. A barrel file (`index.ts` that re-exports a package) can join many files into one cycle; the report shows it as it is.
- `fanIn` and `fanOut` — _fan-in_ is the number of production files that import a file, _fan-out_ the number of files it imports (type-only edges count). `fanIn.median` is over all production files, and the five files with the most of each are listed. A file with a high fan-in is one that much of the code builds on.

`imports.territories` is the dependency map between the territories at the report's default detail (`knowledge.territories.detail`; it is not recomputed per detail), with test files left out. Counts are in import edges between files: `ca` (afferent coupling) is the number of edges from other territories into a territory and `ce` (efferent coupling) the number from it into others. `instability` is `ce / (ca + ce)`, after the stability metrics of Robert C. Martin (_Agile Software Development: Principles, Patterns, and Practices_, 2002): 0 for a territory that others build on and that builds on nothing, 1 for one that only builds on others. It describes how a territory is coupled and is neither good nor bad; it is absent for a territory without any edge. `edges` lists the territory pairs with their file counts, and `towardLessStable` those whose target is at least `thresholds.typescript.imports.instabilityGap` (0.3) more unstable than the source, between territories that each have at least `thresholds.typescript.imports.minEdges` (5) edges, since Martin's stable-dependencies principle says dependencies should point toward stability; other-files territories are not judged. `mutualImports` lists the groups of territories that import each other, directly or through others, by value edges, other-files territories included as links. It is not a file cycle: two territories import each other as soon as each has some file that imports some file of the other. `--limit` cuts these lists, with `totalTerritories`, `totalEdges`, `totalTowardLessStable` and `totalMutualImports` keeping the counts.

Every territory's `typescript` also carries `importsCount` and `importedByCount` (how many territories of the map its production files import, and that import them, leaving out any territory that shares a file with it, so a territory above or below the map's detail is read against the map's territories; the map's `edges` say which) and `inCycle`, which is true when a cycle of production files by value edges runs through the territory and out of it. A territory in a `mutualImports` group can have `inCycle: false`, since the files that import each other across the border need not form a cycle.

### Stories, badges and achievements

The deep dive feeds three things beyond its own blocks, all additive within `schemaVersion` 1 and all describing code, never people.

- **Stories** (`stories`, kinds below). `focused-test` is a `.only`, `fit` or `fdescribe` in the test files (`value` is the focused cases, `path` the first file), and ranks right after the truck-factor alert, since a runner skips every other test while one stays. `complex-core` names the hardest production function and the share of the code in functions at 15 or more; it needs at least 100 production functions and a hardest one of at least 25. `core-territory` names a territory that at least 60% of the other named territories of the import map import, among at least 5 of them. At most two stories about TypeScript show among the six, so knowledge and history stories stay visible. The stories that read `deepDives.typescript.trends` appear only where the history was parsed: `strict-since` says since when `strict` is on in the config that governs the most files, naming the base config when a base flipped it and telling a switch from off to on, a config created strict and a config that was already strict in the first commit the history read (the first-parent chain can start long after the repository, and a shallow clone starts at its boundary, so that case claims no more than "since the first commit read"), `type-trend` a change of at least 30% in the production escape hatches per 1,000 lines over the last 12 months, in either direction and worded without a verdict, and `module-era` either the month since which no production file uses CommonJS or a CommonJS share of at least half. Stories and achievements of the history are dated by the real day of the first-parent commit that ends the month, never by an invented first or last day. Their thresholds are in `thresholds.stories`.
- **Territory badges** (category `code`, rules in `thresholds.badges`). `type-safe`: at least 10 production TypeScript files and no escape hatch per 1,000 production lines once rounded to one decimal. `strict`: every `tsconfig` that governs the territory's files sets `strict` and `noUncheckedIndexedAccess`. `complex-logic`: at least 20 production functions, 10% or more of them at 15 or more. `in-a-cycle`: a file cycle by value imports runs through the territory and out of it; of the four it is the only one that points at a cost, the coupling a cycle brings, and the dashboard colors it as a warning. They need the deep dive, so a territory of a repository without parsed files earns none. A territory's `typescript` carries what they read besides `escapesPer1000`, `strict` and `inCycle`: `productionTypeScriptFiles`, `noUncheckedIndexedAccess`, `functions` (its production functions) and `complexFunctions` (those at 15 or more), the counts `over15Share` is rounded from; `complex-logic` decides on the counts.
- **TypeScript achievements** (`deepDives.typescript.achievements`, shaped like the repository's `achievements` but a list of their own, so the nine of the repository stay as they are). Each is listed, reached or not, with its progress while locked: `any-free` (no explicit `any` in production code, among at least 50 TypeScript files), `strict-throughout` (every TypeScript file under an effectively strict `tsconfig`, among at least 10 production TypeScript files), `esm-only` (no CommonJS in at least 10 production module files, tool configuration files such as `jest.config.js` left out) and `no-ts-ignore` (no `@ts-ignore` and no `@ts-nocheck` in production code, among at least 10 TypeScript files). All four are states: true today and lost when they stop being true. The list is absent for a repository without a production TypeScript file. `tightened` (a milestone: the production escape hatches per 1,000 lines fell by half from their peak) is listed when the history was read.

The terminal shows a "Deep dive: TypeScript" block of at most eight lines after "Stats": the coverage, the escape hatches, the strictness, the complexity, the module systems, the stack, the import cycles and the tests. Names and the parser's words are escaped.

### Inspect

`codesaga inspect` answers per path what an agent needs before it edits: an entry that matches TypeScript or JavaScript files carries `typescript` (absent when none matches or the parser did not load):

- `files`, `testFiles`, `declarationFiles` and `skipped` — the matched files that were parsed (tests included), those of them that are tests, the matched declaration files, which are never parsed, and the matched files the parser skipped.
- `maxComplexity`, `complexFunctions` and `hardest` — over the parsed production files, as the deep dive counts them: the hardest function, how many are at or above `thresholds.typescript.complexityLimit`, and the three hardest with `name`, `path`, `line` and `complexity`.
- `escapes` and `directives` — the escape sites and the `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck` comments in the parsed production files.
- `importedBy` — the production files outside the matched ones that import a matched file (by value or as types): `files` is the count and `top` five paths in order. For a directory, files inside it that import each other are not counted.
- `testedBy` — the test files that import a matched production file, on the same terms; a test file inside the match counts. It says which tests exercise the code by import, not by name, and a test that reaches it through a helper shows only through the helper.
- `strict` — `strict` as the `tsconfig` that governs the matched files sets it (`true`, `false`, `mixed` or `unknown`); absent when none governs one.

To keep `inspect` fast, only the matched files are parsed, plus the files that may import them: every other TypeScript and JavaScript file is read as text, scanned for quoted strings that resolve, as the import graph resolves specifiers, to a matched file, and only those candidates are parsed. A specifier written with an escape sequence, or split over lines, is the one request that could be missed; the parser's own reading of the candidates drops the strings that merely look like imports. On the Effect repository (about 1,700 files) `inspect` takes about 0.6 s more than without the TypeScript figures for a file a handful of files import, and about 1.5 s more for a file that 140 others import.

oxc-parser is codesaga's only runtime dependency. It ships a native binding for each platform, and a native parser can crash its process on hostile input, so codesaga parses in up to four child processes (one fewer than your cores) that run the same program again; a file that kills one is found by bisecting its batch and is the only one lost. The children end with the run and write nothing to stdout. Where it or the binding cannot be loaded (an unsupported platform, or an install that left the optional binding out), `analyze` still succeeds: the section keeps its coverage, every file is skipped as `parser-unavailable`, `parser.version` is `null`, and `unavailable` gives the loader's message. `inspect` loads it only for an argument that matches TypeScript or JavaScript files.

## How the numbers work

- **One pass over the history.** codesaga reads `git log` of HEAD once, following renames. Merge commits are read to keep the commit graph connected but count as nothing. A file deleted and later recreated at the same path starts a new life: knowledge credits only the file that exists today, while the activity sections still count the earlier work. Every section is computed from that.
- **History cache** — the parsed log is kept in `.git/codesaga/history-v2.json` (inside the git directory, so git never tracks it and every clone has its own). The next run reads only the commits made since; after a rebase, a force-push or a change to `.mailmap`, `mailmap.file`, `mailmap.blob`, `refs/replace/`, `info/grafts` or the shallow boundary it reads everything again. The results are the same either way. A cache that cannot be read or written is ignored. `--no-cache` skips it; `rm -rf .git/codesaga` clears it.
- **Facts cache** — the digests of every committed TypeScript and JavaScript blob are kept in `.git/codesaga/syntax-v1.json`, keyed by blob id and parse options, together with a fingerprint of the parser and its version, codesaga's own version, the version of the digest, the input guards and how each extension is read; a different fingerprint discards the file, so the first run after an upgrade of codesaga reads the history again. A blob is a content address, so an entry stays valid until the fingerprint changes. The file keeps only the entries the last run used. `--no-cache` neither reads nor writes it; `rm -rf .git/codesaga` clears it.
- **Universe** — the files that count as code: tracked by git, not ignored, not marked `linguist-generated` or `linguist-vendored`, not in `vendor/`, `node_modules/`, `dist/`, `build/` or generated folders, not binary or minified, and matching the language list or `--include`. Lines added and deleted only count for such paths, so lockfiles and vendored code do not dominate the charts.
- **Activity window** — `--since` until now; without `--since`, the whole history. With `--compare 3m` it is the last three months, and the **previous window** is the three months before: it is exactly as long as the window, to the millisecond (the window starts three calendar months back, so it may be 89 to 92 days, and the previous window has the same length), and ends where the window starts, which belongs to the window. In a repository younger than twice the duration the previous window starts before the first commit; the report flags it as `partial`, and the terminal and dashboard say so. The `comparison` section of the JSON gives both windows' commits, active contributors (people with a commit in the window), lines added and deleted, and automation counts and AI share, and their differences: `change` is window minus previous, `ratio` is `change` over the previous value, `null` when that was zero, and the AI share difference is a fraction (`0.05` is five percentage points), `null` when either window has no commits. The terminal summary and the dashboard's key figures show the differences; they are context, not a verdict. Weeks start on Monday and, like months, are in UTC. The punch card uses each author's own time zone and counts only commits by people.
- **Identities** — a person is their author email after `.mailmap`. Two emails of one person count as two people until `.mailmap` joins them; codesaga never merges by name, because names collide.
- **Active** — a contributor is active (`status` `active` or `new`, counted by `overview.contributors.active90`) with a commit in the last 90 days, and `dormant` otherwise; an expert is active, and a contributor's `active` flag is set, with a commit in the last 183 days; an expert without one is dormant.
- **Commit classes**, first match wins:
  1. **agent** — the author is an AI agent account;
  2. **bot** — the author is a known bot or any other machine account, by its name or GitHub noreply login: one that ends in `[bot]`, `-bot` or `_bot`, or is `bot`, in any case;
  3. **agent-assisted** — a human commit that carries an agent's co-author trailer, marker trailer or message line (a `Co-authored-by:` line in the body counts too, indented or not, when its address belongs to a known agent);
  4. **human** — everything else.

  Recognized agents: Claude Code, GitHub Copilot, Cursor, Codex, Jules, Devin, Aider, Amp, OpenHands, Factory, Kiro, Junie, Cline, and review suggestions accepted from Gemini Code Assist and Windsurf. Recognized bots: Dependabot, Renovate, GitHub Actions, pre-commit.ci, Sweep, and any other such account under its own name (`effect-bot`, `deploy[bot]`; a person named `Abbot` or `Talbot` stays a person). A machine account named otherwise belongs in `signatures` in `.codesaga.json`. Matching goes by email and GitHub account ID first, so a person named Claude stays a person.

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
- **Badges** — `contributors[].badges` lists what a person's commits show, each with a `category` (`focus`, `craft`, `rhythm`, `collaboration` or `journey`), its rule and the numbers behind it. They describe and never rank or compare people: every threshold is absolute and in `thresholds.badges`, no badge says "more than others", and a person's badges come in category order, three of them on a card. The kinds are _all-rounder_, _specialist_ and _keeper_ (focus), _tidier_, _tester_, _documenter_, _toolsmith_ (commits that change only CI, container, manifest, lockfile or known tool configuration files such as `vite.config.ts`, never application code like `app.config.ts`), _type tightener_, _sweeper_, _simplifier_ and _test companion_ (craft; the last four read what a person's own human commits of the 365 days before now did to the TypeScript and JavaScript, whatever `--since` says, as `in-focus` does, by the digests of each file before and after: net removal of at least 20 explicit `any` in 8 commits, of 15 top-level declarations, 10 functions made simpler by 3 or more points of cognitive complexity, and 10 commits that add an exported function (declared with `export`, not an `export { f }` list) of which half also add test cases; a commit that changes more than 50 files in the whole repository, whatever the path argument, is a mass change or codemod and is left out, a function that was only renamed or swapped with another does not count as simplified, and a move between files cancels out. The evidence counts only what was removed or improved, never the inverse, and the badges need the history's parse, so `check` does not carry them), _night owl_, _early bird_ and _weekend regular_ (rhythm), _pair partner_ and _reviewer_ (collaboration), and _founder_, _long-hauler_, _explorer_, _steady_, _new here_ and _back again_ (journey). The rhythm badges read only human commits of the last year on the author's own clock, need 40 of them in 3 calendar months, and are withheld when a person's commits all say UTC while others' do not, since such clocks say nothing about the day. _Reviewer_ is reserved: it needs GitHub logins tied to identities and is not awarded yet.
- **Territories** — the repository cut into non-overlapping slices, as a tree. The first cut is the packages, found by their manifests (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `setup.py`, `pom.xml`, `build.gradle(.kts)`, `*.csproj`, `composer.json`, `Gemfile`, `mix.exs`, `deno.json(c)`), or the top-level folders where a file lies in none. A repository's own manifest makes it a package only when no package lies below it. A territory splits into its child folders when it is big (more than the smaller of 150 files and the larger of 30 files and a quarter of all files, or more than 40 % of all files) or when its folders have different main experts (a main expert is the one person who is an expert on the most files, with no tie, and on at least half of the files that have an expert; two folders differ when neither one's main expert is an expert on half of the other's files), and only when at least two folders hold 3 files or more; the folders with fewer files and the files beside them become its `other` territory ("other files"), listed last. Each split carries its `splitReason` and the `splitDetail` at which it opens. A territory with more than 40 % of the files is split at detail 1, so it is not shown whole, unless it cannot split (fewer than two child folders with 3 files or more): then it is shown whole. A detail is how many splits are open: the others are ordered by value, expertise gain first and then size, and spread over the details 2 to `maxDetail` (at most 6), so every file belongs to exactly one territory at every detail. Each territory has the truck factor, islands and orphaned flags of a directory, over all its files. The report starts at the deepest detail up to which expertise still separates folders and which shows no more territories than the team allows: two per contributor active in 90 days (every contributor if none is), between 4 and 25; `knowledge.territories.reason` says why. `--detail` and `detail` choose another start; the whole tree is in the JSON either way.
- **Code stats** — `stats` in the JSON describes the universe files at HEAD and the history behind them, and every territory of the tree, whatever its depth, carries the same shape: files and code lines, file length (minimum, median, maximum and the longest file), languages, test files by path (a [test path](GLOSSARY.md): a `test`, `tests`, `__tests__`, `spec`, `test-utils`, `test-helpers`, `__mocks__` or `__fixtures__` directory at any depth, or a `*.test.*`, `*.spec.*`, `*_test.go`, `test_*.py` or `*_test.py` file; the same rule tells production from tests in the TypeScript deep dive, the badges and the achievements, and `testing/`, `fixtures/` and `mocks/` stay production), churn (revisions per file: median, 90th percentile, total and the most changed files), indentation complexity and style (indentation, line length, comment lines). A territory's `stats` leave out the histograms and list its three most changed files; the repository's own `stats` add them, as arrays of file counts in a fixed bucket order (file length: 1–50, 51–100, 101–200, 201–400, 401–800 and more than 800 lines; revisions: 1, 2, 3–4, 5–9, 10–19 and 20 or more; levels per line: below 0.25, 0.25 to below 0.5, 0.5 to below 1, 1 to below 1.5, 1.5 to below 2 and 2 or more), and list its five most changed files. A **revision** is a commit that changed the file in the current life of its path, following renames. **Complexity** is ported from [codeheat](https://github.com/rexeus/codeheat): a tab is one indentation level and spaces count `floor(spaces / width)`, the width (2 to 8) detected per file; a file's value is its levels per non-blank line. Comment lines are lines that start with a comment of the language's family (`//` and `/* */`, `#`, `--`, `<!-- -->`); a trailing comment leaves its line a code line, and languages without a listed syntax count none. Only the repository's `stats` adds the share of Conventional Commits and the size of a commit (lines added and deleted in code files), over the non-merge commits of the activity window. Medians and percentiles interpolate between the two closest ranks. A file without a code line counts as a file but is left out of the length and complexity distributions. The code badges `heavyweight`, `hotspot`, `churning` and `deeply-nested` compare a territory's stats with the repository's and also with the territories at the same level of the tree (at least 3 of them; `heavyweight` and `hotspot` need at least twice the fair share, `churning` and `deeply-nested` at least 1.5 times the median of those territories); their thresholds are in `thresholds.badges`. The terminal shows a short "Stats" block.
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
- **The cache file grows with history**, about 2.3 KB per commit; it holds the full blob id and mode of every changed file. An older `history-v1.json` is no longer read and can be deleted.
- **The facts cache grows with the history's distinct file versions**, about 150 bytes per version (9 MB for Effect's 59,000 versions); the first run digests every version once, about 100 seconds on four parse processes for a repository of that size, on a machine shared with other jobs.
- **Import resolution reads the checkout.** It knows no package manager's linking and no bundler aliases outside `tsconfig` and `package.json` `imports`, cannot follow computed `import()` and `require()` arguments (they are counted), and never resolves a package outside the repository, so a monorepo's cross-package edges depend on its workspace manifests and `tsconfig` `paths`.
- **The parser is a native dependency.** An install that drops optional dependencies, such as an npm lockfile made on another platform, leaves the TypeScript deep dive without a parser; it reports why in `coverage.unavailable`. Reinstalling on the target platform fixes it.

## Contributing

See [AGENTS.md](AGENTS.md) for the workflow and rules, [TESTING.md](TESTING.md) for tests, and [docs/](docs/README.md) for everything else. `pnpm install && pnpm check` is the gate.

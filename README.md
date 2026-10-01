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

Requires Node.js 22 or newer and `git` on your PATH. Works for any language.

## What it answers

- **Activity** — commits and lines added and deleted per week, active contributors per month, and when people commit (weekday × hour, in their local time).
- **People** — every contributor with commits, active days, first and last commit, and main areas. There is no score and no ranking by lines: counts are context, not a leaderboard.
- **Knowledge** — who is an expert on which files, the **truck factor** (how many people can leave before more than half of the code has no expert), **knowledge islands** (one person is the only expert) and **orphaned knowledge** (the experts are no longer active).
- **Automation** — how many commits bots wrote, AI agents wrote, or humans wrote with an AI agent, per month and per tool.

## The dashboard

`codesaga analyze --html` writes `codesaga-report.html` — one self-contained file, no network access — and opens it. Top to bottom: key figures, activity, automation, knowledge, contributors, punch card and languages, in light and dark mode. Every chart has a table view, and tables sort by any column.

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
| `--include <glob>`                    | language list    | Replaces the built-in list of source-code extensions. Repeatable.                                                                                                                                            |
| `--exclude <glob>`                    | —                | Removes matching files. Repeatable.                                                                                                                                                                          |
| `--limit <n>`                         | `25`             | Contributors and knowledge directories in `--json`; `0` for all. `totals` always tells the full size.                                                                                                        |
| `--no-cache`                          | cache on         | Reads `git log` instead of the history cache, and leaves the cache alone. See _How the numbers work_.                                                                                                        |
| `--json`                              | off              | One JSON document on stdout; everything else goes to stderr.                                                                                                                                                 |
| `--html`, `--out <file>`, `--no-open` | off              | The dashboard, see above. It always embeds the full report.                                                                                                                                                  |

### `codesaga inspect <path-or-glob...>`

Repository-relative files, directories or globs (quote globs so the shell leaves them alone). Takes `--json`, `--since` and `--no-cache`. Arguments that match nothing are listed under `unmatched`.

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

### Exit codes

| Code | Meaning                                                                                                                                               |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Success                                                                                                                                               |
| 1    | Unexpected failure (including a git command that failed, or an unwritable `--out`)                                                                    |
| 2    | Usage error, such as an unknown flag, an invalid `--since` or `--compare`, `--compare` with `--since`, an invalid `.codesaga.json`, or a missing path |
| 3    | Not inside a git repository, or `git` is not installed                                                                                                |
| 4    | `inspect` matched no file                                                                                                                             |
| 5    | `check`: at least one gate failed                                                                                                                     |

## Configuration

A `.codesaga.json` in the repository root sets defaults for `analyze`, `inspect` and `check`, so a team does not repeat flags. The file is optional, and a flag always wins over it.

```json
{
  "include": ["src/**", "packages/*/src/**"],
  "exclude": ["**/*.generated.ts"],
  "since": "12m",
  "limit": 50,
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
| `gates`      | gate flags  | Limits for `check`, see _Gates in CI_. A flag overrides the config's limit for the same gate; other gates stay.                                          |
| `signatures` | — (no flag) | In-house bots and agents. Each has a `name`, reported as the tool, and `emails` and `names` that identify it: exact matches, ignoring case, no patterns. |

- **Precedence** is flag, then config, then the built-in default. `--compare` sets the window itself, so it ignores the config's `since`; only a `--since` flag conflicts with it. `--include` and `--exclude` replace the config's list; they do not add to it.
- **Signatures** extend the built-in table of [commit classes](#how-the-numbers-work) and never replace it: a person the table already knows keeps its built-in name. A `bots` entry makes the person's commits bot commits; an `agents` entry makes them agent commits, and a human commit with that person as co-author or committer agent-assisted. Matches go by author email, author name, and the emails and names in co-author trailers.
- **The file is checked strictly.** Invalid JSON, an unknown key or a wrong value ends with exit code 2 and a message that names the file and the key, such as `invalid /repo/.codesaga.json: signatures.bots[0].name: Missing key`. A signature needs at least one non-empty entry in `emails` or `names`; entries are trimmed. A config that is a directory, a broken symbolic link, unreadable, or larger than 1 MiB is rejected the same way.
- The file is read from the root of the analyzed repository, not from the directory you run codesaga in. The history cache is unaffected: it holds raw commits, and signatures classify them on every run.

## Gates in CI

`codesaga check` turns the truck factor and its neighbours into a build check. Commit the limits to `.codesaga.json` so reviewers see them change, or pass flags. The history must be complete, because codesaga reads it all: `fetch-depth: 0` is required, and a shallow clone makes `check` warn on stderr that its numbers undercount.

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

## How the numbers work

- **One pass over the history.** codesaga reads `git log` of HEAD once, following renames. Merge commits are read to keep the commit graph connected but count as nothing. A file deleted and later recreated at the same path starts a new life: knowledge credits only the file that exists today, while the activity sections still count the earlier work. Every section is computed from that.
- **History cache** — the parsed log is kept in `.git/codesaga/history-v1.json` (inside the git directory, so git never tracks it and every clone has its own). The next run reads only the commits made since; after a rebase, a force-push or a change to `.mailmap`, `mailmap.file`, `mailmap.blob`, `refs/replace/`, `info/grafts` or the shallow boundary it reads everything again. The results are the same either way. A cache that cannot be read or written is ignored. `--no-cache` skips it; `rm -rf .git/codesaga` clears it.
- **Universe** — the files that count as code: tracked by git, not ignored, not marked `linguist-generated` or `linguist-vendored`, not in `vendor/`, `node_modules/`, `dist/`, `build/` or generated folders, not binary or minified, and matching the language list or `--include`. Lines added and deleted only count for such paths, so lockfiles and vendored code do not dominate the charts.
- **Activity window** — `--since` until now; without `--since`, the whole history. With `--compare 3m` it is the last three months, and the **previous window** is the three months before: it is exactly as long as the window, to the millisecond (the window starts three calendar months back, so it may be 89 to 92 days, and the previous window has the same length), and ends where the window starts, which belongs to the window. In a repository younger than twice the duration the previous window starts before the first commit; the report flags it as `partial`, and the terminal and dashboard say so. The `comparison` section of the JSON gives both windows' commits, active contributors (people with a commit in the window), lines added and deleted, and automation counts and AI share, and their differences: `change` is window minus previous, `ratio` is `change` over the previous value, `null` when that was zero, and the AI share difference is a fraction (`0.05` is five percentage points), `null` when either window has no commits. The terminal summary and the dashboard's key figures show the differences; they are context, not a verdict. Weeks start on Monday and, like months, are in UTC. The punch card uses each author's own time zone and counts only commits by people.
- **Identities** — a person is their author email after `.mailmap`. Two emails of one person count as two people until `.mailmap` joins them; codesaga never merges by name, because names collide.
- **Active** — a commit in the last 183 days.
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

- **Truck factor** — Avelino et al.'s algorithm (ICPC 2016): remove the person who is expert on the most files, again and again, until more than half of the files have no expert. The number removed is the truck factor; the report names them.
- **Directories** — every directory with at least 3 files gets its own truck factor. A **knowledge island** has one person as the only expert on at least 80 % of its files. **Orphaned knowledge** means more than half of its files have no active expert. Directories are listed by risk: orphaned first, then islands, then by truck factor.

The report states every threshold under `thresholds`, and the JSON contract is versioned by `schemaVersion`: new fields may appear, but a field is never renamed or removed without a new version.

## Known limits

- **Expertise is an estimate from history, not a fact.** The model's constants were fitted on other projects; `git blame` line ownership is not used.
- **Scope follows current paths.** A file moved out of `analyze <path>` takes its history with it; a file moved in brings its history along.
- **Shallow clones lack history.** codesaga warns and ignores the boundary commit; run `git fetch --unshallow` for full results. Partial clones (`--filter=blob:none`) make git fetch every blob during the run; use a full clone.
- **Commits dated before 1970 or in the future** are left out.
- **No forge data.** Pull requests, reviews and issues live on GitHub or GitLab, not in git.
- **The cache keys on the mailmap, replace refs, grafts and the shallow boundary, not on every git setting.** A change to `.gitattributes` (such as marking files `-diff`), `.git/info/attributes`, `core.attributesFile`, `diff.algorithm` or `diff.renameLimit` alters what `git log` prints for old commits without invalidating the cache; run once with `--no-cache` and clear it with `rm -rf .git/codesaga`.
- **Linked worktrees share one cache** and rewrite it when their HEADs differ.
- **The cache file grows with history**, about 1.2 KB per commit.

## Contributing

See [AGENTS.md](AGENTS.md) for the workflow and rules, [TESTING.md](TESTING.md) for tests, and [docs/](docs/README.md) for everything else. `pnpm install && pnpm check` is the gate.

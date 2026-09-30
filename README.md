# codesaga

The story of a git repository: how active it is, who built it, where the knowledge sits and whether it is still in the team, and how much of the work AI agents and bots do.

codesaga reads the local git history only. It works offline, for any host and any branch, without a token. Humans get a self-contained dashboard, agents and scripts get versioned JSON.

```bash
npx codesaga analyze                      # the story in the terminal
npx codesaga analyze --html               # the dashboard in the browser
npx codesaga analyze --json               # the full report for agents and scripts
npx codesaga inspect packages/billing     # who knows this code, and are they still here?
```

Requires Node.js 22 or newer and `git` on your PATH. Works for any language.

## What it answers

- **Activity** — commits and lines added and deleted per week, active contributors per month, and when people commit (weekday × hour, in their local time).
- **People** — every contributor with commits, active days, first and last commit, and main areas. There is no score and no ranking by lines: counts are context, not a leaderboard.
- **Knowledge** — who is an expert on which files, the **truck factor** (how many people can leave before more than half of the code has no expert), **knowledge islands** (one person is the only expert) and **orphaned knowledge** (the experts are no longer active).
- **Automation** — how many commits bots wrote, AI agents wrote, or humans wrote with an AI agent, per month and per tool.

## The dashboard

`codesaga analyze --html` writes `codesaga-report.html` — one self-contained file, no network access — and opens it. Top to bottom: key figures, activity, automation, knowledge, contributors, punch card and languages, in light and dark mode. Every chart has a table view, and tables sort by any column.

`--out <file>` picks the path and implies `--html`; `--no-open` skips the browser. The path is printed to stderr, so `--html --json` still gives a clean stdout.

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

| Flag                                  | Default          | Meaning                                                                                                                                          |
| ------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[path]`                              | whole repository | A directory (or file) inside a repository; only changes under it count. Also works for a repository elsewhere: `codesaga analyze ../other-repo`. |
| `--since <when>`                      | whole history    | Narrows the activity sections: `<n>d`, `<n>w`, `<n>m`, `<n>y`, or `YYYY-MM-DD`. Knowledge always uses the full history.                          |
| `--include <glob>`                    | language list    | Replaces the built-in list of source-code extensions. Repeatable.                                                                                |
| `--exclude <glob>`                    | —                | Removes matching files. Repeatable.                                                                                                              |
| `--limit <n>`                         | `25`             | Contributors and knowledge directories in `--json`; `0` for all. `totals` always tells the full size.                                            |
| `--no-cache`                          | cache on         | Reads `git log` instead of the history cache, and leaves the cache alone. See _How the numbers work_.                                            |
| `--json`                              | off              | One JSON document on stdout; everything else goes to stderr.                                                                                     |
| `--html`, `--out <file>`, `--no-open` | off              | The dashboard, see above. It always embeds the full report.                                                                                      |

### `codesaga inspect <path-or-glob...>`

Repository-relative files, directories or globs (quote globs so the shell leaves them alone). Takes `--json`, `--since` and `--no-cache`. Arguments that match nothing are listed under `unmatched`.

### Exit codes

| Code | Meaning                                                                            |
| ---- | ---------------------------------------------------------------------------------- |
| 0    | Success                                                                            |
| 1    | Unexpected failure (including a git command that failed, or an unwritable `--out`) |
| 2    | Usage error, such as an unknown flag, an invalid `--since`, or a missing path      |
| 3    | Not inside a git repository, or `git` is not installed                             |
| 4    | `inspect` matched no file                                                          |

## How the numbers work

- **One pass over the history.** codesaga reads `git log` of HEAD once, without merge commits, following renames. A file deleted and later recreated at the same path starts a new life: knowledge credits only the file that exists today, while the activity sections still count the earlier work. Every section is computed from that.
- **History cache** — the parsed log is kept in `.git/codesaga/history-v1.json` (inside the git directory, so git never tracks it and every clone has its own). The next run reads only the commits made since; after a rebase, a force-push or a change to `.mailmap`, `mailmap.file`, `mailmap.blob` or the shallow boundary it reads everything again. The results are the same either way. A cache that cannot be read or written is ignored. `--no-cache` skips it; `rm -rf .git/codesaga` clears it.
- **Universe** — the files that count as code: tracked by git, not ignored, not marked `linguist-generated` or `linguist-vendored`, not in `vendor/`, `node_modules/`, `dist/`, `build/` or generated folders, not binary or minified, and matching the language list or `--include`. Lines added and deleted only count for such paths, so lockfiles and vendored code do not dominate the charts.
- **Activity window** — `--since` until now; without `--since`, the whole history. Weeks start on Monday and, like months, are in UTC. The punch card uses each author's own time zone and counts only commits by people.
- **Identities** — a person is their author email after `.mailmap`. Two emails of one person count as two people until `.mailmap` joins them; codesaga never merges by name, because names collide.
- **Active** — a commit in the last 183 days.
- **Commit classes**, first match wins:
  1. **agent** — the author is an AI agent account;
  2. **bot** — the author is a known bot or any other `[bot]` account;
  3. **agent-assisted** — a human commit that carries an agent's co-author trailer, marker trailer or message line;
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
- **A commit with several agents counts for one of them** in the per-tool list.
- **Indented `Co-Authored-By:` lines** inside a squashed commit body are not git trailers and are not detected.
- **Scope follows current paths.** A file moved out of `analyze <path>` takes its history with it; a file moved in brings its history along.
- **Shallow clones lack history.** codesaga warns and ignores the boundary commit; run `git fetch --unshallow` for full results. Partial clones (`--filter=blob:none`) make git fetch every blob during the run; use a full clone.
- **Commits dated before 1970 or in the future** are left out.
- **No forge data.** Pull requests, reviews and issues live on GitHub or GitLab, not in git.
- **The cache keys on the mailmap and the shallow boundary, not on every git setting.** A change to `.gitattributes` (such as marking files `-diff`) or to `diff.renameLimit` alters what `git log` prints for old commits without invalidating the cache; run once with `--no-cache` and clear it with `rm -rf .git/codesaga`.

## Contributing

See [AGENTS.md](AGENTS.md) for the workflow and rules, [TESTING.md](TESTING.md) for tests, and [docs/](docs/README.md) for everything else. `pnpm install && pnpm check` is the gate.

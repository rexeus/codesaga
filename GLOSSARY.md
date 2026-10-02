# Glossary

The words codesaga uses in the report, the terminal, the dashboard and the code. They are the same everywhere: a term here is the name of the JSON field, the flag and the heading. The terms are grouped by what they describe.

## The code

**Universe** — the set of files an analysis considers code: a regular file tracked by git (no symlink or submodule), not ignored, not marked `linguist-generated` or `linguist-vendored`, not binary or minified, and matching the language allow-list or the `--include` globs. Line counts and knowledge are relative to the universe.

**Life of a path** — the history of the file that exists at a path today: from the commit that created it (or renamed a file onto the path) to HEAD, following renames. A deletion ends the life of the file that had that name, however the file's history is named today, so a file created or renamed onto the path afterwards starts a new one. Knowledge reads only the current life; the activity sections count every life, because that work happened. Deleting and re-adding a path in one commit is an edit, not a new life.

**Package root** — a directory that holds a package manifest: `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `setup.py`, `pom.xml`, `build.gradle`, `build.gradle.kts`, any `*.csproj`, `composer.json`, `Gemfile`, `mix.exs`, `deno.json` or `deno.jsonc`. The file name is the only signal. A root with no universe file holds nothing, and the analysis scope's own manifest makes the scope a package only when no package lies below it.

**Territory** — a slice of the universe that, together with its siblings at the same detail, covers every file exactly once (`knowledge.territories` in the report). It is a package, a folder or the other files of a folder, and a territory at a finer detail lies inside one at a coarser detail. A territory has the knowledge fields of a directory. A file directly in a package root belongs to that root's own territory, and a scope that is a file is one territory, that file. Knowledge is always _of_ a territory, never _whose_ it is: nobody owns one.

**Package** — the territory kind (`kind: "package"`) for a package root and everything below it that no finer territory claims.

**Folder** — the territory kind (`kind: "folder"`) for a directory below a package root or below the scope, or for the scoped file itself when `analyze` is given a file.

**Other files** — the territory kind (`kind: "other"`) for the files of a folder that are too few to be a territory: folders with fewer than 3 files are grouped per parent as one territory, listed last at its detail. Its `path` is the parent folder, so a package and its other files share a path; `path` and `kind` together identify a territory. Other files do not count toward the recommended detail, and with fewer than 3 files they are never a knowledge island or orphaned.

**Detail** — how finely territories are cut (`--detail`, the slider "Detail", `detail` and `recommendedDetail` in the report). Detail 1 is the package roots, or the top-level folders below the scope when there are no packages; each further detail goes one folder step deeper, up to detail 6, and a detail that would repeat the one before it is not reported. A territory holding more than 40% of the files and having subfolders is split further within its detail, by one step when that already yields two territories of at least 3 files and by two steps at most otherwise.

**Recommended detail** — the detail whose count of territories that are not other files is closest to two per contributor active in 90 days (4 to 25, a tie to the coarser detail). The report starts there unless `--detail` says otherwise, and `reason` states the choice in words.

**Knowledge island** — a territory where one person is the sole expert on at least 80% of the files.

**Orphaned knowledge** — a territory where more than 50% of the files have no active expert.

## People

**Identity** — a person as the history sees them: the mailmap-normalized, lowercased author email. The display name is the most recent name used with that email. Identities are never merged by name; `.mailmap` joins two emails.

**Contributor** — an identity with at least one human or agent-assisted commit. Bots and agents are not contributors; they appear under Bots & Agents.

**Active, New, Dormant** — the status of a contributor, judged over the 90 days before now (`Clock`), not before HEAD: an archived repository should say that nobody is around. A contributor is _new_ when the first commit is also in those 90 days (and someone committed earlier), _active_ when there is a commit in those days and the first commit is older, and _dormant_ otherwise. New and active together are the overview's `active90`; the overview also counts active contributors at 30 and 365 days.

**Expert (DOE)** — a human whose Degree of Expertise for a file is at least 0.7 times the highest DOE among the file's authors, with at least one added line. DOE weighs lines added, first authorship, days since the last commit to the file (measured from the HEAD commit) and file size. Bot and agent commits never make an expert; agent-assisted commits credit their human author.

**Active expert, dormant expert** — an expert is active with a commit in the 183 days (six months) before now and dormant otherwise. It decides whether a territory is orphaned, which experts are suggested as reviewers, and the `active` flag of a contributor and of an expert; a dormant expert has `active: false`. A contributor can be dormant and still carry `active: true` for a while.

**Line owner** — an identity that `git blame` credits with lines of a set of files at HEAD, counted in non-blank lines with whitespace-only changes ignored and `.mailmap` applied. Only with `--blame`. Unlike an expert, a line owner may be a bot or an agent; the report marks its kind. Expertise says who knows a file from its history, line ownership who wrote what remains.

**Truck factor** — the number of people who must leave before more than half of a file set has no expert, found by removing, greedily, the person who is expert on the most still-covered files. The report names the removed people in order.

## Bots and agents

**Agent commit** — a commit whose author is an AI agent, such as `claude[bot]` or the Copilot cloud agent. Checked before the bot rule, because several agents commit as `[bot]` accounts.

**Agent-assisted commit** — a commit by a human author that carries an agent's co-author trailer, marker trailer or message line, or an agent committer. A `Co-authored-by:` line in the body that git did not parse as a trailer counts when its address is a known agent's. It counts for the human. A missing trailer means "not detected", not "human-written".

**Bot commit** — a commit whose author is an automation account such as Dependabot, or any other `[bot]` account that is not an agent.

## Time

**Activity window** — the time range of history that the activity sections (overview, activity, punch card, contributors, bots and agents) consider, from `--since` (default: the first commit) to now, resolved to absolute dates in the report. Knowledge ignores it and always uses the full history.

**Previous window** — with `--compare <duration>`, the span of exactly the same length, in milliseconds, right before the activity window: it ends where the window starts (the boundary instant belongs to the window). It is partial when it starts before the repository's first commit in scope. The report's `comparison` section sets the two windows' figures side by side; it is a difference, not a ranking.

## Stories, badges and achievements

**Story** — a notable fact about the repository's history or team (`stories` in the report): an anniversary, the longest streak, night or weekend work, newcomers, a quiet territory, the most renamed file, the biggest cleanup, the busiest day, a truck factor of one, or orphaned knowledge. Each has a threshold in `thresholds.stories` and appears only when it passes, ranked by notability, six at most. A story names an event or a team fact and never ranks one person against another. An anniversary says in `unit` whether its `value` counts years or days.

**Badge** — a labelled fact about a territory or a contributor that passes a fixed threshold in `thresholds.badges`; each carries its `kind`, `label`, and the `evidence` behind it. A badge is positive or neutral for people, never a score, and there are none about working hours. Territory badges also carry a `category`: _Knowledge_, _Code_ or _Activity_. A card shows three badges at most and counts the rest.

Territory badges, grouped by category:

- _Knowledge:_ **Knowledge island** (`island`) — a territory that is a knowledge island. **Orphaned** (`orphaned`) — a territory with orphaned knowledge. **One expert** (`one-expert`) — exactly one active expert, and not an island. **Shared knowledge** (`shared-knowledge`) — at least 4 active experts and a truck factor of at least 4. **Knowledge fading** (`knowledge-fading`) — the main expert has been silent for 90 to 183 days. **Handover** (`handover`) — the previous main expert (the dormant expert on the most files) is replaced by an active main expert whose first commit to the territory is at most 180 days old. **Newcomer-friendly** (`newcomer-friendly`) — at least 2 people made their first commit here in the last 180 days.
- _Activity:_ **New territory** (`new-territory`) — the first commit is at most 90 days old and at least 180 days after the repository's own first commit, so the territories of a young repository are not new one by one. **In focus** (`in-focus`) — the most human and agent-assisted commits of any territory at this detail in the last 90 days, whatever the activity window. **Quiet** (`quiet`) — unchanged for at least 183 days.
- _Code:_ **Well tested** (`well-tested`) — at least 40% of the files are tests; never for a territory whose own path is inside a test directory.

Badges of a contributor:

- **All-rounder** (`all-rounder`) — commits in at least half of the territories and in at least 4; never when the history has one contributor.
- **X specialist** (`specialist`) — at least 80% of the commits fall into one territory X, from 10 commits on.
- **Keeper of X** (`keeper`) — the only active expert of territory X; never when the history has one contributor.
- **Tidier** (`tidier`) — net deletions of at least 500 code lines.
- **Founder** (`founder`) — first author of at least 25% of today's files.
- **Tester** (`tester`) — at least 40% of the changed files are tests, from 10 commits on.
- **Documenter** (`documenter`) — at least 40% of the commits touch documentation, from 10 commits on.
- **Steady** (`steady`) — a commit in each of the last 6 months.
- **New here** (`new-here`) — the first commit is at most 90 days old and someone committed earlier.
- **Back again** (`back-again`) — active again after a pause of at least 183 days.
- **Reviewer** (`reviewer`) — at least 10 reviews; needs `--github` and is not awarded yet, since reviews are not tied to identities.

**Achievement** — a milestone the repository as a whole has reached, such as a round number of commits or contributors. It states a reached threshold and never compares people. The report does not list achievements yet.

## Page and commands

**Sections of the page** — the dashboard's sections in page order: _Stories_ (only when there are some), _Activity_, _Pull requests_ (only with `--github`), _Knowledge_, _Team_ and _Bots & Agents_ (only when the history shows a bot or an agent). The navigation lists the same names.

**Gate** — a limit that `codesaga check` holds the repository to: a minimum or maximum on one measure (truck factor, orphaned directories, knowledge islands, agent and agent-assisted share of commits, or contributors active in 90 days). A measurement exactly at its limit passes. `check` exits 5 when any gate fails and evaluates none in a shallow clone.

## Former names

For readers of 0.2.0 development builds, whose reports and flags used other words:

| Former                                 | Now                                                             |
| -------------------------------------- | --------------------------------------------------------------- |
| area, part                             | territory                                                       |
| `knowledge.areas`, `levels`, `depth`   | `knowledge.territories`, `details`, `detail`                    |
| level, `--depth`, `recommendedDepth`   | detail, `--detail` (`--depth` still works), `recommendedDetail` |
| rest area, loose files, `kind: "rest"` | other files, `kind: "other"`                                    |
| `kind: "directory"` (an area)          | `kind: "folder"`                                                |
| highlight, `highlights`                | story, `stories`                                                |
| inactive expert                        | dormant expert                                                  |
| Single expert, New, Cleaner            | One expert, New territory, Tidier                               |
| Welcome, Returning                     | New here, Back again                                            |
| Specialist: X                          | X specialist                                                    |
| Highlights, People (page sections)     | Stories, Team                                                   |

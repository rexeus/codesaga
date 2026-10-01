# Glossary

**Universe** — the set of files an analysis considers code: a regular file tracked by git (no symlink or submodule), not ignored, not marked `linguist-generated` or `linguist-vendored`, not binary or minified, and matching the language allow-list or the `--include` globs. Line counts and knowledge are relative to the universe.

**Activity window** — the time range of history that the activity sections (overview, activity, punch card, contributors, automation) consider, from `--since` (default: the first commit) to now, resolved to absolute dates in the report. Knowledge ignores it and always uses the full history.

**Previous window** — with `--compare <duration>`, the span of exactly the same length, in milliseconds, right before the activity window: it ends where the window starts (the boundary instant belongs to the window). It is partial when it starts before the repository's first commit in scope. The report's `comparison` section sets the two windows' figures side by side; it is a difference, not a ranking.

**Identity** — a person as the history sees them: the mailmap-normalized, lowercased author email. The display name is the most recent name used with that email. Identities are never merged by name; `.mailmap` joins two emails.

**Contributor** — an identity with at least one human or agent-assisted commit. Bots and agents are not contributors; they appear under automation.

**Active** — a contributor with a commit in the 183 days before now (`Clock`), not before HEAD: an archived repository should say that nobody is around. The overview also counts active contributors at 30, 90 and 365 days.

**Agent commit** — a commit whose author is an AI agent, such as `claude[bot]` or the Copilot cloud agent. Checked before the bot rule, because several agents commit as `[bot]` accounts.

**Agent-assisted commit** — a commit by a human author that carries an agent's co-author trailer, marker trailer or message line, or an agent committer. A `Co-authored-by:` line in the body that git did not parse as a trailer counts when its address is a known agent's. It counts for the human. A missing trailer means "not detected", not "human-written".

**Bot commit** — a commit whose author is an automation account such as Dependabot, or any other `[bot]` account that is not an agent.

**Life of a path** — the history of the file that exists at a path today: from the commit that created it (or renamed a file onto the path) to HEAD, following renames. A deletion ends the life of the file that had that name, however the file's history is named today, so a file created or renamed onto the path afterwards starts a new one. Knowledge reads only the current life; the activity sections count every life, because that work happened. Deleting and re-adding a path in one commit is an edit, not a new life.

**Expert (DOE)** — a human whose Degree of Expertise for a file is at least 0.7 times the highest DOE among the file's authors, with at least one added line. DOE weighs lines added, first authorship, days since the last commit to the file (measured from the HEAD commit) and file size. Bot and agent commits never make an expert; agent-assisted commits credit their human author.

**Truck factor** — the number of people who must leave before more than half of a file set has no expert, found by removing, greedily, the person who is expert on the most still-covered files. The report names the removed people in order.

**Knowledge island** — a directory where one person is the sole expert on at least 80% of the files.

**Orphaned knowledge** — a directory where more than 50% of the files have no active expert.

**Gate** — a limit that `codesaga check` holds the repository to: a minimum or maximum on one measure (truck factor, orphaned directories, knowledge islands, agent and agent-assisted share of commits, or contributors active in 90 days). A measurement exactly at its limit passes. `check` exits 5 when any gate fails and evaluates none in a shallow clone.

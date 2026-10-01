---
"codesaga": minor
---

`analyze --blame` and `inspect --blame` also show who wrote the lines that exist today, from `git blame`, next to the expertise signal. With the flag, each knowledge directory and each `inspect` entry gets an additive `lineOwners` object (lines blamed in total, and the five authors with the most lines, each with `lines`, `share` and `kind` of `human`, `agent` or `bot`), the terminal view adds a "leading line owner" column, and the dashboard a "Line owners" column. `.codesaga.json` accepts `blame: true`, and `--no-blame` turns it off for one run. Blame runs one `git` process per file, so it is opt-in and slower on large repositories; without the flag nothing changes.

A file that `git blame` cannot read is left out of the line owners and counted in `lineOwners.skippedFiles`; the command then warns once on stderr. `knowledge.lineOwners` (and `lineOwners` in the `inspect` result) give the figures for the whole scope. `inspect` also reports `shallow` and warns on stderr in a shallow clone, as `analyze` does; line ownership is unreliable there.

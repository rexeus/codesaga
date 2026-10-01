---
"codesaga": minor
---

`codesaga analyze --compare 3m` compares the last three months with the three months before. The JSON gains an optional `comparison` section (both windows' commits, active contributors, lines and automation counts, and the deltas; `schemaVersion` stays 1), the terminal summary shows the changes for commits, contributors, lines added and AI share, and the dashboard's key figures show them next to their values. `--compare` takes `<n>d`, `<n>w`, `<n>m` or `<n>y` and cannot be combined with `--since`.

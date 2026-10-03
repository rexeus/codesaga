---
"codesaga": minor
---

Four craft badges for contributors, read from what a person's own human commits of the 365 days before now, whatever `--since` says, did to the TypeScript and JavaScript: `type-tightener` (at least 20 explicit `any` net removed in 8 commits), `sweeper` (15 top-level declarations net removed), `simplifier` (10 functions made simpler by 3 or more points of cognitive complexity) and `test-companion` (10 commits that add an exported function, half of them with test cases). They compare the facts of each file before and after a commit, skip commits that change more than 50 files in the whole repository and never show the inverse. Their thresholds are in `thresholds.badges`.

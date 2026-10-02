---
"codesaga": minor
---

The report gains code stats: `stats` for the repository and `stats` on every territory in `knowledge.territories`. They describe the files at HEAD and the history behind them: files and code lines, file length with a histogram and the longest file, languages, test files, churn (revisions per file with renames followed, median, 90th percentile, histogram and the five most changed files), indentation complexity ported from codeheat, and style (indentation, line length, comment lines). The repository's `stats` also carry the share of Conventional Commits and the commit size over the activity window. Four code badges join `well-tested`: `heavyweight`, `hotspot`, `churning` and `deeply-nested`, with their thresholds in `thresholds.badges`. `analyze` prints a short "Stats" block.

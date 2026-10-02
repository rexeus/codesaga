---
"codesaga": minor
---

The report gains code stats: `stats` for the repository and `stats` on every territory in `knowledge.territories`. They describe the files at HEAD and the history behind them: files and code lines, file length with the longest file, languages, test files, churn (revisions per file with renames followed, median, 90th percentile and the most changed files), indentation complexity ported from codeheat, and style (indentation, line length, comment lines). The repository's `stats` also carry histograms (bare arrays of file counts in a fixed, documented bucket order), the five most changed files where a territory lists three, the share of Conventional Commits and the commit size over the activity window. Four code badges join `well-tested`: `heavyweight`, `hotspot`, `churning` and `deeply-nested`, with their thresholds in `thresholds.badges`. `analyze` prints a short "Stats" block.

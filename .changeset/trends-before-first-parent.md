---
"codesaga": patch
---

The TypeScript trends no longer start late when a repository's history was absorbed through a merge. A history that shares no commit with the lineage of HEAD, such as the packages a monorepo migration merged in with `--allow-unrelated-histories` (with or without a directory), is replayed along its own first-parent chain until the merge that took it in, so the series start with the repository's first commit instead of the month HEAD's own chain begins. No file is counted twice, and the last point is still HEAD's committed tree. The `tsconfig` flag events follow those histories as well. On a repository of Effect's size the series now start in 2020-05 instead of 2023-12. A history that was merged into a branch before that branch was merged, and a shallow clone, are replayed as before.

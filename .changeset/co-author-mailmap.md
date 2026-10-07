---
"codesaga": patch
---

Resolve `Co-authored-by` trailers through `.mailmap` (and `mailmap.file`, `mailmap.blob`), as authors already are, with one `git check-mailmap` call per run. One person who co-authors under two addresses, such as a GitHub noreply address, now counts once, and an author's own alias is no longer taken for another person, which affects the pair partner badge.

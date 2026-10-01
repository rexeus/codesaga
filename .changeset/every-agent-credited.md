---
"codesaga": patch
---

A commit that carries several agents' trailers, such as Claude Code and Cursor, now counts for each of them in `automation.tools[].assisted` and in the `inspect` reasons. `automation.totals.agentAssisted` still counts the commit once.

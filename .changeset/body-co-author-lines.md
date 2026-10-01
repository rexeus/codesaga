---
"codesaga": patch
---

Known agent `Co-authored-by:` lines inside a commit body, such as the indented ones that squash merges keep, now mark the commit as agent-assisted. Only an agent's address counts, never a name in prose, and only when the line holds exactly one address. The first run after the update reads the whole history again.

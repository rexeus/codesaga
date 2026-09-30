---
"codesaga": minor
---

First release. `codesaga analyze [path]` tells the story of a git repository from its local history: activity per week and month, contributors and who is still active, a weekday × hour punch card, where knowledge sits (experts per file by Degree of Expertise, the truck factor, knowledge islands and orphaned directories), and how many commits bots and AI agents wrote or helped with. It prints a terminal summary, `--json` emits the versioned report (`schemaVersion: 1`), and `--html` writes a self-contained dashboard. `codesaga inspect <path-or-glob...>` answers, per argument, who knows that code and whether they are still around.

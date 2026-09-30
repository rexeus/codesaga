---
"codesaga": minor
---

`analyze` and `inspect` keep the parsed history in `.git/codesaga/history-v1.json` and read only the commits made since the last run, so a repeated run takes a fraction of a second instead of seconds. A rebase, a force-push or a change to `.mailmap` makes the next run read everything again, and the results are the same as without the cache. `--no-cache` skips it; `rm -rf .git/codesaga` clears it.

---
"codesaga": patch
---

The history cache now keeps the full blob id and mode of every changed file, so the file is `.git/codesaga/history-v2.json` and the first run after the update reads the log once more. The cache is about twice as large (about 2.3 KB per commit instead of 1.2 KB); `rm .git/codesaga/history-v1.json` removes the old file.

---
"codesaga": minor
---

`codesaga mcp` serves `analyze`, `inspect` and `check` as Model Context Protocol tools over stdio, so agent hosts such as Claude Code can discover and call them instead of running commands (`claude mcp add codesaga -- npx codesaga mcp`). The tools take the flags' parameters, return the `--json` documents, honor the repository's `.codesaga.json` and the history cache, and report failures with the messages of the command line.

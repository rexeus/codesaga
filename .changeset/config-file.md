---
"codesaga": minor
---

A `.codesaga.json` in the repository root now sets defaults for `analyze` and `inspect`: `include`, `exclude`, `since`, `limit`, and `signatures` to recognize in-house bots and agents by exact email or name. Flags override the file, and a list flag replaces the file's list. An invalid file (bad JSON, an unknown key, a wrong value) ends with exit code 2 and names the file and the key.

---
"codesaga": patch
---

`analyze --out <file>` checks the target before it reads any history. An empty path, an existing directory (including `.` and a name ending in a slash), an unwritable file, or a missing, non-directory or unwritable parent directory now fails at once with exit code 1, instead of after the whole analysis.

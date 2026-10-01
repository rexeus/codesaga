---
"codesaga": patch
---

`analyze --out <file>` checks the file's directory before it reads any history. A missing, non-directory or unwritable directory now fails at once with exit code 1 and names the directory, instead of after the whole analysis.

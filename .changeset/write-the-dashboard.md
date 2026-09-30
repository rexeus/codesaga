---
"codesaga": minor
---

`analyze --html` writes the dashboard as one self-contained HTML file (`codesaga-report.html`, or `--out <file>`) and opens it in the browser unless `--no-open` is given. The file embeds the untruncated report; the path is printed to stderr, so `--html --json` still gives a clean stdout.

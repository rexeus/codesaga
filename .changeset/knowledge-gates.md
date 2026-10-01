---
"codesaga": minor
---

New command `codesaga check [path]` fails CI when knowledge risk crosses a threshold. Set limits with `--min-truck-factor`, `--max-orphaned`, `--max-islands`, `--max-agent-share` and `--min-active-contributors`, or under `gates` in `.codesaga.json`; a flag overrides the config for the same gate. It prints one line per gate with its reason, or one JSON document with `--json`, and exits with the new code 5 when a gate fails. Without any gate it exits 2. In a shallow clone `check` evaluates no gate and exits 2 with a hint to fetch the full history.

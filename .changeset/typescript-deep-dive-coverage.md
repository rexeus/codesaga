---
"codesaga": minor
---

`analyze` parses the TypeScript and JavaScript files of the universe at HEAD with oxc-parser and reports `deepDives.typescript.coverage`: the files seen, the files parsed, the declaration files (`.d.ts`, counted and not parsed), the files skipped by reason (`too-large`, `minified`, `too-deep`, `syntax-error`, `parser-error`, `unreadable`, `parser-unavailable`) and the parser with its version. The section is additive within `schemaVersion` 1 and absent for a repository without TypeScript or JavaScript. Hostile input (deep nesting, huge or minified files) is skipped and counted, never fatal, and a parser that cannot load, such as a missing platform binding, degrades the section to its coverage with `unavailable` set and never fails the run. `inspect` does not load the parser. oxc-parser is the package's first runtime dependency, because its native binding cannot be bundled.

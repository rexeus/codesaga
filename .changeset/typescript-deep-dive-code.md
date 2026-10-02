---
"codesaga": minor
---

`deepDives.typescript` describes the code at HEAD. `typeSafety` counts the escape hatches of the type system (`any`, `as` assertions other than `as const`, double assertions, `as any`, `x!`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable*`, `oxlint-disable*`, `biome-ignore`) and their counterparts (`satisfies`, `unknown`, type predicates), per 1,000 non-blank lines, for production code and tests apart, and lists up to five `@ts-nocheck` files. Every territory gains `typescript` with its parsed files, their lines and its escape hatches per 1,000 production lines. The blocks are additive within `schemaVersion` 1.

---
"codesaga": minor
---

`deepDives.typescript` describes the code at HEAD. `typeSafety` counts the escape hatches of the type system (`any`, `as` assertions other than `as const`, double assertions, `as any`, `x!`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable*`, `oxlint-disable*`, `biome-ignore`) and their counterparts (`satisfies`, `unknown`, type predicates), per 1,000 non-blank lines, for production code and tests apart, and lists up to five `@ts-nocheck` files. Every territory gains `typescript` with its parsed files, their lines and its escape hatches per 1,000 production lines. The blocks are additive within `schemaVersion` 1.

`strictness` reports each `tsconfig*.json` with its effective options: `strict` and the parts that differ, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`, `isolatedModules`, `allowJs`, `checkJs`, `target`, `module` and `moduleResolution`, the `extends` chain and the specifiers that could not be resolved (an option such an `extends` may have set is `unknown`, never guessed), the declared TypeScript version (TypeScript 6 defaults `strict` to true) and the files each config governs. A territory's `typescript.strict` is `true`, `false` or `mixed`. `--limit` cuts the list of configs.

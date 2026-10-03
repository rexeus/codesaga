// Owns the shape of `deepDives.typescript.achievements`: the milestones of the code's type safety and module system.
// Same shape as the repository's `Achievement`, in a list of their own so the pinned list of nine stays as it is.
// A new kind is an additive change; renaming or removing one bumps the schema version.
import { Schema } from "effect";

import { Achievement } from "./achievements.js";

/**
 * One TypeScript achievement, shaped like `Achievement`: `title`, `detail`,
 * `reached`, `holds`, `reachedAt` and `progress` mean what they mean there.
 * Every kind the analysis can judge is listed, reached or not, in the order
 * below; `tightened` is listed only when the history was read. The list is
 * absent when the repository has no production TypeScript file. All of them
 * describe production code, as `deepDives.typescript.typeSafety` splits it,
 * and none names a person.
 *
 * - `any-free` (state): no explicit `any` keyword in production code, among at least `thresholds.achievements.anyFreeMinFiles` TypeScript files. `progress` counts the production files without one.
 * - `strict-throughout` (state): every TypeScript file lies under a config that is effectively strict, among at least `thresholds.achievements.typeScriptMinFiles` files.
 * - `esm-only` (state): no production file uses CommonJS, among at least `typeScriptMinFiles` files that use a module system.
 * - `no-ts-ignore` (state): no `@ts-ignore` and no `@ts-nocheck` in production code, among at least `typeScriptMinFiles` TypeScript files.
 * - `tightened` (milestone): the production escape hatches per 1,000 lines fell by at least `thresholds.achievements.tightenedFall` from their peak; `reachedAt` is the last day of the first month it showed, or the day of the analysis for the current month.
 */
export const TypeScriptAchievement = Schema.Struct({
  ...Achievement.fields,
  kind: Schema.Literals([
    "any-free",
    "strict-throughout",
    "esm-only",
    "no-ts-ignore",
    "tightened",
  ]),
});
export type TypeScriptAchievement = typeof TypeScriptAchievement.Type;

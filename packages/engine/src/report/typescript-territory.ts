// Owns the compact TypeScript figures every territory carries beside its code stats.
// The repository's own figures live in `deepDives.typescript`; these let a card be held against them.
import { Schema } from "effect";

import { TerritoryStrict } from "./typescript-strictness.js";

/**
 * What the deep dive says of a territory's TypeScript and JavaScript files at
 * HEAD. Absent when the territory holds no parsed file of those languages.
 */
export const TerritoryTypeScript = Schema.Struct({
  /** Parsed TypeScript and JavaScript files of the territory. */
  files: Schema.Natural,
  /** Non-blank lines of those files. */
  codeLines: Schema.Natural,
  /**
   * Escape hatches per 1,000 non-blank lines of the territory's production
   * files, as `deepDives.typescript.typeSafety` counts them. Absent when the
   * territory has no production line.
   */
  escapesPer1000: Schema.optionalKey(Schema.Finite),
  /**
   * `strict` as the configs that govern the territory's files set it: `true`
   * or `false` when they agree, `mixed` when they do not. Absent when no
   * config governs one of its files.
   */
  strict: Schema.optionalKey(TerritoryStrict),
  /**
   * The share of ES module files among the files that use a module system:
   * the files with ESM syntax over those and the files with CommonJS, as
   * `deepDives.typescript.modules` counts them. Absent when no file of the
   * territory uses either.
   */
  esmShare: Schema.optionalKey(
    Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
  ),
});
export type TerritoryTypeScript = typeof TerritoryTypeScript.Type;

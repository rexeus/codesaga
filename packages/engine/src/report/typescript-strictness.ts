// Owns the shape of `deepDives.typescript.strictness`: what each `tsconfig` makes the compiler check.
// Posture as facts ("strict on, `noUncheckedIndexedAccess` off"), never a grade.
import { Schema } from "effect";

/** An effective option: on, off, or `unknown` where a config that could not be read may have decided it. */
const Setting = Schema.Literals([true, false, "unknown"]);
export type Tri = typeof Setting.Type;

/**
 * What a territory's governed files say about `strict`: `true` or `false`
 * when all agree, `mixed` when some are strict and some are not, and
 * `unknown` when a config that could not be read decides it.
 */
export const TerritoryStrict = Schema.Literals([
  true,
  false,
  "mixed",
  "unknown",
]);
export type TerritoryStrict = typeof TerritoryStrict.Type;

/**
 * One `tsconfig*.json` with its effective options: its own over the configs
 * it extends, a later `extends` entry over an earlier one. An option that a
 * config in `unresolved` may have set is `unknown`, never the default.
 */
const ConfigPosture = Schema.Struct({
  /** Repository-relative path. */
  path: Schema.String,
  /** The configs it extends, directly and through each other, base first; paths relative to the repository. */
  extends: Schema.Array(Schema.String),
  /** Specifiers of `extends` entries that no file was found for, such as an npm preset that is not installed. */
  unresolved: Schema.Array(Schema.String),
  /** TypeScript and JavaScript files it governs: the deepest config that selects a file, `tsconfig.json` over its variants. JavaScript counts only with `allowJs` and `checkJs`. */
  files: Schema.Natural,
  /** Effective `strict`; where it is unset, on for TypeScript 6 and later and off before. */
  strict: Setting,
  /** The parts of `strict` set to a value other than `strict`'s own, such as `strictNullChecks` in a strict config; the parts set explicitly when `strict` is `unknown`. */
  strictExceptions: Schema.Array(Schema.String),
  noUncheckedIndexedAccess: Setting,
  exactOptionalPropertyTypes: Setting,
  noImplicitOverride: Setting,
  verbatimModuleSyntax: Setting,
  isolatedModules: Setting,
  allowJs: Setting,
  checkJs: Setting,
  /** As written; null when no readable config sets it. */
  target: Schema.NullOr(Schema.String),
  module: Schema.NullOr(Schema.String),
  moduleResolution: Schema.NullOr(Schema.String),
});

/**
 * The compiler posture the repository declares. Without a `tsconfig` (a
 * JavaScript-only repository, say) `configs` is empty and says so.
 */
export const Strictness = Schema.Struct({
  typescript: Schema.Struct({
    /** The version range from the root `package.json`, a pnpm catalog resolved; null when none is readable. */
    declared: Schema.NullOr(Schema.String),
    /** What an unset `strict` means for it: TypeScript 6 and later default it to true. `unknown` without a readable version. */
    strictByDefault: Setting,
  }),
  /** The configs, the most files first, then by path; possibly truncated by the output limit, see `totalConfigs`. */
  configs: Schema.Array(ConfigPosture),
  /** The `tsconfig*.json` files read, before the output limit. */
  totalConfigs: Schema.Natural,
  /** TypeScript and JavaScript files that some config governs. */
  governedFiles: Schema.Natural,
  /** TypeScript files (declaration files included) that no config governs. */
  ungovernedFiles: Schema.Natural,
  /**
   * JavaScript files that no config governs, as is usual without `allowJs`
   * and `checkJs`: they are not type-checked and not a gap. With
   * `governedFiles` and `ungovernedFiles` they add up to `coverage.files`.
   */
  jsFilesOutsideConfigs: Schema.Natural,
});
export type Strictness = typeof Strictness.Type;

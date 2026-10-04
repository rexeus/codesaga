// Owns the shape of `deepDives.typescript.idioms`: paired counts of two ways of writing the same thing.
// Descriptive, not evidence of quality: no study says which side is better, and the section never names a paradigm.
import { Schema } from "effect";

const Count = Schema.Natural;

/**
 * How the production code is written. Each pair counts the same kind of
 * syntax on both sides, so the sum of a pair is its denominator and its
 * share is the count over that sum. Tests are left out, since they are
 * written in another style. Calls are counted by method name, as no types
 * are known.
 */
export const Idioms = Schema.Struct({
  /** Production files the counts rest on. */
  files: Count,
  /** `interface` declarations against `type` aliases of an object type literal. */
  declarations: Schema.Struct({ interfaces: Count, objectTypes: Count }),
  /** `enum` declarations that are not ambient against `type` aliases of a union of string literals. */
  enums: Schema.Struct({ enums: Count, stringUnions: Count }),
  /** Top-level classes, functions and `const` bindings of an arrow or function expression. */
  topLevel: Schema.Struct({
    classes: Count,
    functions: Count,
    arrowConsts: Count,
  }),
  /** `await` expressions against `.then(` calls. */
  async: Schema.Struct({ awaits: Count, thenCalls: Count }),
  /** Class members named `#x` against members marked `private`, parameter properties included. */
  privacy: Schema.Struct({ hashPrivate: Count, privateModifiers: Count }),
  /** `export default` and `export { x as default }` against every other exported name. */
  exports: Schema.Struct({ defaultExports: Count, namedExports: Count }),
  /** `const`, `let` and `var` declarations. */
  bindings: Schema.Struct({ consts: Count, lets: Count, vars: Count }),
  /** `for...of` loops against `.forEach(` calls. */
  iteration: Schema.Struct({ forOf: Count, forEachCalls: Count }),
  /**
   * Calls that mutate (`push`, `pop`, `shift`, `unshift`, `splice`, `sort`,
   * `reverse`, `fill`, `copyWithin`) against calls that return a new value
   * (`map`, `filter`, `reduce`, `reduceRight`, `flatMap`, `flat`,
   * `toSorted`, `toReversed`, `toSpliced`) and spread elements in
   * array and object literals.
   */
  mutation: Schema.Struct({
    mutationCalls: Count,
    transformCalls: Count,
    spreads: Count,
  }),
  /** Optional chains `a?.b`, each chain once, and `??` and `??=`. */
  nullish: Schema.Struct({ optionalChains: Count, nullishCoalescing: Count }),
});
export type Idioms = typeof Idioms.Type;

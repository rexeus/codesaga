// Owns the idiom facts of one file: how often each of two ways of writing the same thing appears.
// Counts of syntax, never labels: nothing here calls code functional or object-oriented, and `var` or `.then` are era markers, not smells.

/**
 * Idiom counts of one file, each pair counted over the same kind of node so
 * that its two sides compare. Calls are counted by method name, since no
 * types are known: `.sort(` on anything counts as mutation.
 */
export type IdiomFacts = {
  /** `interface` declarations, and `type` aliases of an object type literal. */
  readonly interfaces: number;
  readonly objectTypes: number;
  /** `enum` declarations that are not ambient, and `type` aliases of a union of string literals. */
  readonly enums: number;
  readonly stringUnions: number;
  /** Top-level declarations, exported or not: classes, functions, and `const` bindings of an arrow or function expression. */
  readonly classes: number;
  readonly functions: number;
  readonly arrowConsts: number;
  /** `await` expressions, and `.then(` calls. */
  readonly awaits: number;
  readonly thenCalls: number;
  /** Class members named `#x`, and members marked `private` (parameter properties included). */
  readonly hashPrivate: number;
  readonly privateModifiers: number;
  /** `export default` declarations and `export { x as default }`, and every other exported name, at the top level of the file: the `export` of a namespace member is not an export of the module. */
  readonly defaultExports: number;
  readonly namedExports: number;
  /** `const`, `let` and `var` declarations. */
  readonly consts: number;
  readonly lets: number;
  readonly vars: number;
  /** `for...of` loops, and `.forEach(` calls. */
  readonly forOf: number;
  readonly forEachCalls: number;
  /** `.push(`, `.pop(`, `.shift(`, `.unshift(`, `.splice(`, `.sort(`, `.reverse(`, `.fill(` and `.copyWithin(` calls. */
  readonly mutationCalls: number;
  /** `.map(`, `.filter(`, `.reduce(`, `.reduceRight(`, `.flatMap(`, `.flat(`, `.toSorted(`, `.toReversed(` and `.toSpliced(` calls. Neither list counts a call on a PascalCase name (`Effect.map`) or on a string; `slice` and `concat` are left out, since strings have them too. */
  readonly transformCalls: number;
  /** Spread elements in array and object literals, which transform without mutating. */
  readonly spreads: number;
  /** Optional chains `a?.b`, each chain once, and `??` and `??=`. */
  readonly optionalChains: number;
  readonly nullishCoalescing: number;
  /** What Node's type stripping cannot erase besides enums: runtime namespaces, parameter properties and decorators. */
  readonly namespaces: number;
  readonly parameterProperties: number;
  readonly decorators: number;
};

/** The counts while a file is read. */
export type IdiomCounts = { -readonly [Key in keyof IdiomFacts]: number };

/** A file that has none of the idioms. */
export const noIdioms = (): IdiomCounts => ({
  interfaces: 0,
  objectTypes: 0,
  enums: 0,
  stringUnions: 0,
  classes: 0,
  functions: 0,
  arrowConsts: 0,
  awaits: 0,
  thenCalls: 0,
  hashPrivate: 0,
  privateModifiers: 0,
  defaultExports: 0,
  namedExports: 0,
  consts: 0,
  lets: 0,
  vars: 0,
  forOf: 0,
  forEachCalls: 0,
  mutationCalls: 0,
  transformCalls: 0,
  spreads: 0,
  optionalChains: 0,
  nullishCoalescing: 0,
  namespaces: 0,
  parameterProperties: 0,
  decorators: 0,
});

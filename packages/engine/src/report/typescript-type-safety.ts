// Owns the shape of `deepDives.typescript.typeSafety`: the escape hatches of the type system and their counterparts.
// Production code and tests are reported apart, as tests use assertions and `any` on purpose. Counts and rates, never a score.
import { Schema } from "effect";

const Count = Schema.Natural;

/** The same keys over any value type, so `counts` and `per1000` cannot drift apart. */
const byMeasure = <S extends Schema.Top>(value: S) =>
  Schema.Struct({
    /** Every `any` keyword in a type, `as any` included. */
    any: value,
    /** Every `as T` and `<T>x`, except `as const`. */
    assertions: value,
    /** Assertions that cast a value already cast to `unknown` or `any` (`as unknown as T`); part of `assertions`. */
    doubleAssertions: value,
    /** Assertions to `any`; part of `assertions` and of `any`. */
    asAny: value,
    /** Non-null assertions `x!`. */
    nonNull: value,
    /** `@ts-ignore` comments, which stay silent when the line has no error. */
    tsIgnore: value,
    /** `@ts-expect-error` comments, which fail when the line has no error. */
    tsExpectError: value,
    /** `@ts-nocheck` comments. */
    tsNocheck: value,
    /** `eslint-disable*`, `oxlint-disable*` and `biome-ignore` comments. */
    lintDisables: value,
    /** The counterparts, which keep types honest: `satisfies` expressions. */
    satisfies: value,
    /** Every `unknown` keyword in a type. */
    unknown: value,
    /** Type predicates `x is T` and `asserts x is T`. */
    typePredicates: value,
  });

/**
 * The type safety of one set of parsed files. `escapes` adds `any`,
 * `assertions`, `nonNull`, `tsIgnore`, `tsExpectError`, `tsNocheck` and
 * `lintDisables`, so `as any` counts as the two holes it is; `doubleAssertions` and
 * `asAny` are parts of those and not added again. `per1000` divides each count
 * by `lines`, in thousands, and keeps 4 decimals.
 */
const TypeSafetyPart = Schema.Struct({
  /** Parsed files in the set. */
  files: Count,
  /** Non-blank lines of those files, the denominator of every rate. */
  lines: Count,
  /** Files with at least one escape. */
  filesWithEscape: Count,
  /** `filesWithEscape` divided by `files`; 0 for no files. */
  escapeFileShare: Schema.Finite.check(
    Schema.isBetween({ minimum: 0, maximum: 1 }),
  ),
  escapes: Count,
  escapesPer1000: Schema.Finite,
  counts: byMeasure(Count),
  per1000: byMeasure(Schema.Finite),
});

/**
 * Escape hatches and counterparts in the parsed code, read from syntax and
 * comments without a type checker. JSDoc types of JavaScript are not read.
 */
export const TypeSafety = Schema.Struct({
  /** Files that are not tests, by the path rule of the `well-tested` badge. */
  production: TypeSafetyPart,
  /** Test files. */
  tests: TypeSafetyPart,
  /** Files with a `@ts-nocheck` comment, tests included, first by path; at most five. */
  nocheckFiles: Schema.Array(Schema.String).check(Schema.isMaxLength(5)),
});
export type TypeSafety = typeof TypeSafety.Type;

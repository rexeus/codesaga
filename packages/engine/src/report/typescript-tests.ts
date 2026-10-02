// Owns the shape of `deepDives.typescript.tests`: the test cases of the test files and how they are marked.
// Cases are found by the call shapes of Jest, Vitest, Mocha, node:test, Bun and Playwright, without resolving imports, so a runner with other names is not seen. Counts, never a target.
import { Schema } from "effect";

const Count = Schema.Natural;

/** The tests of the parsed test files. */
export const Tests = Schema.Struct({
  /** Test files by the path rule of the `well-tested` badge, parsed. */
  files: Count,
  /** The test frameworks `ecosystem` detected, by name. */
  frameworks: Schema.Array(Schema.String),
  /** Test cases declared: `it`, `test` and their `skip`, `only`, `todo` and `each` forms, an `each` table once. */
  cases: Count,
  /** The cases declared with `each`; part of `cases`. */
  parameterized: Count,
  /** Cases and suites marked `skip`, `xit`, `xtest` or `xdescribe`; a skipped suite counts once. */
  skipped: Count,
  /** Cases and suites marked `only`, `fit` or `fdescribe`: a runner skips every other test while one is committed. */
  focused: Count,
  /** Cases marked `todo`; part of `cases`. */
  todo: Count,
  /** Files that hold a focused marker, first by path; at most five. */
  focusedFiles: Schema.Array(Schema.String).check(Schema.isMaxLength(5)),
  /**
   * The cases that have a body (every case but a `todo`) with 0, 1, 2 to 3, and
   * 4 or more direct assertions: `expect(...)`, `expect.soft`, `expect.poll`,
   * `assert(...)` and `assert.x(...)` inside the case's own callback. A
   * case that asserts in a helper it calls shows as 0: the figure says "no
   * direct assertion", and no study ties assertions per test to quality.
   */
  assertions: Schema.Array(Count),
  /** Snapshot matcher calls such as `toMatchSnapshot` and `toHaveScreenshot`. */
  snapshots: Count,
  /** Type-test calls: `expectTypeOf`, `assertType` and `expectType`. */
  typeTests: Count,
});
export type Tests = typeof Tests.Type;

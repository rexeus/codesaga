// Owns the test facts of one file: the test cases it declares, how they are marked, and how many assertions each makes directly.
// Counted wherever the calls appear; the report reads them from test files only. A case's assertions are the calls inside its own callback, nested callbacks included, never those of a helper it calls.

import type { CallExpression } from "@oxc-project/types";

import { histogram } from "../../stats/histogram.js";
import type { FactsCollector } from "../parsed-source.js";
import { onNodes } from "../walk.js";
import { signalOf, testCallOf } from "./test-calls.js";
import type { TestCall } from "./test-calls.js";

/** The first value of each assertion band after `0`: bands `0`, `1`, `2–3` and `4+`. */
export const ASSERTION_EDGES: ReadonlyArray<number> = [1, 2, 4];

/** Counts of one file; additive across files. */
export type TestFacts = {
  /** Test cases declared: `it`, `test` and their `skip`, `only`, `todo` and `each` forms, an `each` once. */
  readonly cases: number;
  /** The cases declared with `each`. */
  readonly parameterized: number;
  /** Cases and suites marked `skip`, `xit`, `xtest` or `xdescribe`; a skipped suite counts once, as the marker it is. */
  readonly skipped: number;
  /** Cases and suites marked `only`, `fit` or `fdescribe`. */
  readonly focused: number;
  /** Cases marked `todo`. */
  readonly todo: number;
  /** The cases that have a body, which is every case but a `todo`, with 0, 1, 2 to 3, and 4 or more direct assertions. */
  readonly assertions: ReadonlyArray<number>;
  /** Snapshot matcher calls: `toMatchSnapshot`, `toMatchInlineSnapshot`, `toHaveScreenshot` and kin. */
  readonly snapshots: number;
  /** Type-test calls: `expectTypeOf(...)`, `assertType(...)` and `expectType(...)`. */
  readonly typeTests: number;
};

/** Counts test facts over one walk. */
export const testCollector = (): FactsCollector<TestFacts> => {
  const counts = {
    cases: 0,
    parameterized: 0,
    skipped: 0,
    focused: 0,
    todo: 0,
    snapshots: 0,
    typeTests: 0,
  };
  const open: { readonly node: object; assertions: number }[] = [];
  const perCase: number[] = [];
  const declare = (call: TestCall, node: CallExpression): void => {
    const isCase = call.kind === "case";
    counts.cases += isCase ? 1 : 0;
    counts.parameterized += isCase && call.each ? 1 : 0;
    counts.skipped += call.skipped ? 1 : 0;
    counts.focused += call.focused ? 1 : 0;
    counts.todo += isCase && call.todo ? 1 : 0;
    if (isCase && !call.todo) {
      open.push({ node, assertions: 0 });
    }
  };
  const observe = (node: CallExpression): void => {
    const signal = signalOf(node);
    counts.snapshots += signal === "snapshot" ? 1 : 0;
    counts.typeTests += signal === "type-test" ? 1 : 0;
    const current = open.at(-1);
    if (signal === "assertion" && current !== undefined) {
      current.assertions += 1;
    }
  };
  return {
    enter: onNodes({
      CallExpression: (node) => {
        const call = testCallOf(node);
        if (call === undefined) {
          observe(node);
        } else {
          declare(call, node);
        }
      },
    }),
    leave: onNodes({
      CallExpression: (node) => {
        if (open.at(-1)?.node === node) {
          perCase.push(open.pop()?.assertions ?? 0);
        }
      },
    }),
    finish: () => ({
      ...counts,
      assertions: histogram(perCase, ASSERTION_EDGES),
    }),
  };
};

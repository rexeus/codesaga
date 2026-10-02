// Owns turning the type-safety facts of many files into the report's block.
// Rates divide by the non-blank lines of the same set, so a set's figures never rest on files it does not hold.

import type { TypeSafety } from "../../report/typescript-type-safety.js";
import { ratioOf, sum } from "../../stats/measures.js";
import { isTestPath } from "../../universe/path-kinds.js";
import type { ParsedFile } from "../parsed-file.js";
import type { TypeSafetyFacts } from "./type-safety-facts.js";

const NO_FACTS: TypeSafetyFacts = {
  any: 0,
  assertions: 0,
  doubleAssertions: 0,
  asAny: 0,
  nonNull: 0,
  tsIgnore: 0,
  tsExpectError: 0,
  tsNocheck: 0,
  lintDisables: 0,
  satisfies: 0,
  unknown: 0,
  typePredicates: 0,
};

/** Applies `combine` to the two facts count by count; the one place that spells out every count. */
const zip = (
  left: TypeSafetyFacts,
  right: TypeSafetyFacts,
  combine: (left: number, right: number) => number,
): TypeSafetyFacts => ({
  any: combine(left.any, right.any),
  assertions: combine(left.assertions, right.assertions),
  doubleAssertions: combine(left.doubleAssertions, right.doubleAssertions),
  asAny: combine(left.asAny, right.asAny),
  nonNull: combine(left.nonNull, right.nonNull),
  tsIgnore: combine(left.tsIgnore, right.tsIgnore),
  tsExpectError: combine(left.tsExpectError, right.tsExpectError),
  tsNocheck: combine(left.tsNocheck, right.tsNocheck),
  lintDisables: combine(left.lintDisables, right.lintDisables),
  satisfies: combine(left.satisfies, right.satisfies),
  unknown: combine(left.unknown, right.unknown),
  typePredicates: combine(left.typePredicates, right.typePredicates),
});

/** The escape hatches of one file; `asAny` and `doubleAssertions` are parts of `any` and `assertions`. */
const escapesOf = (facts: TypeSafetyFacts): number =>
  sum([
    facts.any,
    facts.assertions,
    facts.nonNull,
    facts.tsIgnore,
    facts.tsExpectError,
    facts.tsNocheck,
    facts.lintDisables,
  ]);

type Part = TypeSafety["production"];

const partOf = (files: ReadonlyArray<ParsedFile>): Part => {
  const counts = files.reduce(
    (total, { facts }) => zip(total, facts.typeSafety, (a, b) => a + b),
    NO_FACTS,
  );
  const lines = sum(files.map((file) => file.lines));
  const filesWithEscape = files.filter(
    ({ facts }) => escapesOf(facts.typeSafety) > 0,
  ).length;
  const escapes = escapesOf(counts);
  return {
    files: files.length,
    lines,
    filesWithEscape,
    escapeFileShare: ratioOf(filesWithEscape, files.length),
    escapes,
    escapesPer1000: ratioOf(escapes * 1000, lines),
    counts,
    per1000: zip(counts, counts, (count) => ratioOf(count * 1000, lines)),
  };
};

const MAX_NOCHECK_FILES = 5;

/** Production code and tests apart, and the files that turn the checker off. */
export const typeSafetyOf = (files: ReadonlyArray<ParsedFile>): TypeSafety => {
  const tests = files.filter(({ path }) => isTestPath(path));
  return {
    production: partOf(files.filter(({ path }) => !isTestPath(path))),
    tests: partOf(tests),
    nocheckFiles: files
      .filter(({ facts }) => facts.typeSafety.tsNocheck > 0)
      .map(({ path }) => path)
      .toSorted()
      .slice(0, MAX_NOCHECK_FILES),
  };
};

/**
 * The escape hatches per 1,000 production lines of `files`, or undefined
 * when none of them is production code.
 */
export const productionEscapesPer1000 = (
  files: ReadonlyArray<ParsedFile>,
): number | undefined => {
  const { lines, escapesPer1000 } = partOf(
    files.filter(({ path }) => !isTestPath(path)),
  );
  return lines === 0 ? undefined : escapesPer1000;
};

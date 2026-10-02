// Owns what one commit did to the TypeScript and JavaScript files it changed, as the craft badges read it: the difference of the digests of each file before and after.
// Moves between files cancel out in a commit's sum. A file whose version before or after has no digest says nothing and is left out.
import type { FileChange } from "../history/history.js";
import type { FileDigest } from "../typescript/digest/file-digest.js";
import { MAX_NOTABLE_PER_FILE } from "../typescript/functions/function-thresholds.js";
import { changeFactsOf } from "../typescript/trends/facts-lookup.js";
import type { FactsLookup } from "../typescript/trends/facts-lookup.js";
import { isTestPath } from "../universe/path-kinds.js";
import { CONTRIBUTOR_BADGE_THRESHOLDS } from "./contributor-badge-thresholds.js";

const { craftMaxFilesPerCommit, simplifierMinDrop } =
  CONTRIBUTOR_BADGE_THRESHOLDS;

/** A function that was simplified to `2` when it vanished from the list of functions of 3 or more counts as lowered to this. */
const VANISHED_COMPLEXITY = 2;

/** What a commit did to its files; every count is a difference, positive for what was removed unless the name says added. */
export type CommitDelta = {
  /** Explicit `any` net removed. */
  readonly removedAny: number;
  /** Top-level classes, functions and arrow-function constants net removed. */
  readonly removedDeclarations: number;
  /** Functions whose cognitive complexity the commit lowered by `simplifierMinDrop` or more. */
  readonly simplified: number;
  /** Whether the commit added an exported function to a production file. */
  readonly addedExportedFunction: boolean;
  /** Test cases net added in test files. */
  readonly addedTestCases: number;
};

/** The functions whose name is unique in the list, by name. */
const uniqueByName = (
  functions: FileDigest["notable"],
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  for (const [name] of functions) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return new Map(functions.filter(([name]) => counts.get(name) === 1));
};

/**
 * The functions of one file that a commit made simpler. A function is matched
 * by its name where that is unique in both versions. One that left the list of
 * functions of 3 or more counts as lowered to 2, as long as the file did not
 * lose functions, so that a deleted function is not taken for a simplified one.
 * A commit that adds functions to the file, or a file whose list was cut at
 * `MAX_NOTABLE_PER_FILE` in either version, counts nothing: absent and
 * truncated look alike there.
 */
const simplifiedIn = (before: FileDigest, after: FileDigest): number => {
  if (
    after.functions > before.functions ||
    before.notable.length >= MAX_NOTABLE_PER_FILE ||
    after.notable.length >= MAX_NOTABLE_PER_FILE
  ) {
    return 0;
  }
  const complexityAfter = uniqueByName(after.notable);
  const namesAfter = new Set(after.notable.map(([name]) => name));
  let simplified = 0;
  for (const [name, complexity] of uniqueByName(before.notable)) {
    const found = complexityAfter.get(name);
    const lowered =
      found === undefined &&
      !namesAfter.has(name) &&
      after.functions === before.functions
        ? VANISHED_COMPLEXITY
        : found;
    if (lowered !== undefined && complexity - lowered >= simplifierMinDrop) {
      simplified += 1;
    }
  }
  return simplified;
};

/** What `count` reads of a version, or 0 where the commit has no such version of the file. */
const of = (
  digest: FileDigest | null,
  count: (digest: FileDigest) => number,
): number => (digest === null ? 0 : count(digest));

/** What one change did, or undefined when a version has no digest or the change is not a TypeScript or JavaScript file. */
const deltaOfChange = (
  change: FileChange,
  lookup: FactsLookup,
): CommitDelta | undefined => {
  const facts = changeFactsOf(change, lookup);
  if (facts === undefined || (facts.before === null && facts.after === null)) {
    return undefined;
  }
  const { before, after } = facts;
  const grew = (count: (digest: FileDigest) => number): number =>
    of(after, count) - of(before, count);
  return {
    removedAny: -grew((digest) => digest.any),
    removedDeclarations: -grew((digest) => digest.declarations),
    simplified:
      before === null || after === null ? 0 : simplifiedIn(before, after),
    addedExportedFunction:
      !isTestPath(change.path) &&
      grew((digest) => digest.topLevelFunctions) > 0 &&
      grew((digest) => digest.exportedDeclarations) > 0,
    addedTestCases: isTestPath(change.path)
      ? grew((digest) => digest.testCases)
      : 0,
  };
};

/**
 * What the commit did to the files the facts cover, or undefined when it
 * changes more than `craftMaxFilesPerCommit` files (a mass change or a
 * codemod says nothing of a person's craft) or none of them is covered.
 */
export const commitDeltaOf = (
  changes: ReadonlyArray<FileChange>,
  lookup: FactsLookup,
): CommitDelta | undefined => {
  if (changes.length > craftMaxFilesPerCommit) {
    return undefined;
  }
  const deltas = changes.flatMap(
    (change) => deltaOfChange(change, lookup) ?? [],
  );
  return deltas.length === 0
    ? undefined
    : {
        removedAny: deltas.reduce((sum, { removedAny }) => sum + removedAny, 0),
        removedDeclarations: deltas.reduce(
          (sum, { removedDeclarations }) => sum + removedDeclarations,
          0,
        ),
        simplified: deltas.reduce((sum, { simplified }) => sum + simplified, 0),
        addedExportedFunction: deltas.some(
          ({ addedExportedFunction }) => addedExportedFunction,
        ),
        addedTestCases: deltas.reduce(
          (sum, { addedTestCases }) => sum + addedTestCases,
          0,
        ),
      };
};

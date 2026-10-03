// Owns what one commit did to the TypeScript and JavaScript files it changed, as the craft badges read it: the difference of the digests of each file before and after.
// Moves between files cancel out in a commit's sum. A file whose version before or after has no digest says nothing and is left out.
import type { ClassifiedCommit } from "../automation/classify.js";
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

/** How one function moved: lowered by `simplifierMinDrop` or more, a little easier, or harder; nothing for one whose later complexity is unknown. */
const movementOf = (
  before: number,
  after: number | undefined,
): { lowered: number; simpler: number; harder: number } => {
  if (after === undefined) {
    return { lowered: 0, simpler: 0, harder: 0 };
  }
  return before - after >= simplifierMinDrop
    ? { lowered: 1, simpler: before - after, harder: 0 }
    : { lowered: 0, simpler: 0, harder: Math.max(0, after - before) };
};

/**
 * The functions of one file that a commit made simpler, matched by their name
 * where that is unique in both versions. One that left the list of functions
 * of 3 or more counts as lowered to 2, but only when the list gained no
 * name, so that a renamed function is not taken for a simplified one, and the
 * file did not lose functions, so that a deleted one is not either. A commit
 * that adds functions to the file, a file whose list was cut at
 * `MAX_NOTABLE_PER_FILE` in either version (absent and truncated look
 * alike), and a file whose functions got harder by as much as the lowered
 * ones got simpler (a swap) count nothing.
 */
const simplifiedIn = (before: FileDigest, after: FileDigest): number => {
  if (
    after.functions > before.functions ||
    before.notable.length >= MAX_NOTABLE_PER_FILE ||
    after.notable.length >= MAX_NOTABLE_PER_FILE
  ) {
    return 0;
  }
  const namesBefore = new Set(before.notable.map(([name]) => name));
  const newcomers = after.notable.filter(([name]) => !namesBefore.has(name));
  const namesAfter = new Set(after.notable.map(([name]) => name));
  const complexityAfter = uniqueByName(after.notable);
  const vanishedTo =
    after.functions === before.functions && newcomers.length === 0
      ? VANISHED_COMPLEXITY
      : undefined;
  let lowered = 0;
  let simpler = 0;
  let harder = newcomers.reduce((sum, [, complexity]) => sum + complexity, 0);
  for (const [name, complexity] of uniqueByName(before.notable)) {
    const move = movementOf(
      complexity,
      complexityAfter.get(name) ??
        (namesAfter.has(name) ? undefined : vanishedTo),
    );
    lowered += move.lowered;
    simpler += move.simpler;
    harder += move.harder;
  }
  return harder >= simpler ? 0 : lowered;
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
      grew((digest) => digest.exportedFunctions) > 0,
    addedTestCases: isTestPath(change.path)
      ? grew((digest) => digest.testCases)
      : 0,
  };
};

/**
 * What the commit did to the files the digests cover, or undefined when it
 * changed more than `craftMaxFilesPerCommit` files in the whole repository,
 * whatever the analysis scope (a mass change or a codemod says nothing of a
 * person's craft), or none of them is covered.
 */
export const commitDeltaOf = (
  { changes, changedFiles }: Pick<ClassifiedCommit, "changes" | "changedFiles">,
  lookup: FactsLookup,
): CommitDelta | undefined => {
  if (changedFiles > craftMaxFilesPerCommit) {
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

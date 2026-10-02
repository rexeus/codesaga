// Owns turning the function facts of many files into the report's `functions` block and the figures a territory carries.
// Percentiles come from the files' score tallies, so they are exact; the bands are the sums of the files' bands.

import type {
  FunctionsPart,
  Functions,
} from "../../report/typescript-functions.js";
import { mergeIntegerTallies, percentiles } from "../../stats/distribution.js";
import { ratioOf, sum, sumColumns } from "../../stats/measures.js";
import { isTestPath } from "../../universe/path-kinds.js";
import type { ParsedFile } from "../parsed-file.js";
import {
  COMPLEXITY_EDGES,
  COMPLEXITY_LIMIT,
  LENGTH_EDGES,
  TOP_FUNCTIONS,
} from "./function-thresholds.js";

const functionsOf = (file: ParsedFile) => file.facts.functions;

/** The functions in the bands at or above the complexity limit. */
const overLimit = (bands: ReadonlyArray<number>): number =>
  sum(bands.slice(COMPLEXITY_EDGES.indexOf(COMPLEXITY_LIMIT) + 1));

/** The highest score among the files' functions; 0 for none. */
const maxScoreOf = (files: ReadonlyArray<ParsedFile>): number =>
  files.reduce(
    (highest, file) =>
      functionsOf(file).scores.reduce(
        (inner, [score]) => Math.max(inner, score),
        highest,
      ),
    0,
  );

const topOf = (files: ReadonlyArray<ParsedFile>): FunctionsPart["top"] =>
  files
    .flatMap((file) =>
      functionsOf(file).notable.map(({ name, line, complexity, lines }) => ({
        name,
        path: file.path,
        line,
        complexity,
        lines,
      })),
    )
    .toSorted(
      (left, right) =>
        right.complexity - left.complexity ||
        Number(left.path > right.path) - Number(left.path < right.path) ||
        left.line - right.line,
    )
    .slice(0, TOP_FUNCTIONS);

const partOf = (files: ReadonlyArray<ParsedFile>): FunctionsPart => {
  const count = sum(files.map((file) => functionsOf(file).count));
  const codeLines = sum(files.map((file) => file.lines));
  const bands = sumColumns(
    files.map((file) => functionsOf(file).complexity),
    COMPLEXITY_EDGES.length + 1,
  );
  const over15 = overLimit(bands);
  const hardLines = sum(files.map((file) => functionsOf(file).hardLines));
  const [p50, p90] = percentiles(
    mergeIntegerTallies(files.map((file) => new Map(functionsOf(file).scores))),
    [0.5, 0.9],
  );
  return {
    files: files.length,
    codeLines,
    functions: count,
    complexity: {
      bands,
      p50: p50 ?? 0,
      p90: p90 ?? 0,
      max: maxScoreOf(files),
    },
    over15: {
      functions: over15,
      share: ratioOf(over15, count),
      lines: hardLines,
      lineShare: ratioOf(hardLines, codeLines),
    },
    top: topOf(files),
    lengths: sumColumns(
      files.map((file) => functionsOf(file).lengths),
      LENGTH_EDGES.length + 1,
    ),
    longParameterLists: sum(
      files.map((file) => functionsOf(file).longParameterLists),
    ),
    maxDepth: files.reduce(
      (deepest, file) => Math.max(deepest, functionsOf(file).maxDepth),
      0,
    ),
  };
};

/** Production code and tests apart. */
export const functionsReportOf = (
  files: ReadonlyArray<ParsedFile>,
): Functions => ({
  production: partOf(files.filter(({ path }) => !isTestPath(path))),
  tests: partOf(files.filter(({ path }) => isTestPath(path))),
});

/** What a territory carries of its production functions. */
export type TerritoryFunctions = {
  readonly functions: number;
  readonly over15Share: number;
  readonly maxComplexity: number;
};

/** The count of production functions, the share at 15 or more and the highest score, undefined when the files hold no production function. */
export const productionFunctionFigures = (
  files: ReadonlyArray<ParsedFile>,
): TerritoryFunctions | undefined => {
  const production = files.filter(({ path }) => !isTestPath(path));
  const count = sum(production.map((file) => functionsOf(file).count));
  if (count === 0) {
    return undefined;
  }
  const over15 = sum(
    production.map((file) => overLimit(functionsOf(file).complexity)),
  );
  return {
    functions: count,
    over15Share: ratioOf(over15, count),
    maxComplexity: maxScoreOf(production),
  };
};

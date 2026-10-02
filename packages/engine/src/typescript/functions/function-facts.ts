// Owns the function facts of one file: how many functions it holds and how complex, long and wide they are.
// Cognitive complexity follows the SonarSource whitepaper (v1.7); `function-collector.ts` computes it, this module keeps what a file's functions add up to.

import { tallyOf } from "../../stats/distribution.js";
import { histogram } from "../../stats/histogram.js";
import {
  COMPLEXITY_EDGES,
  COMPLEXITY_LIMIT,
  LENGTH_EDGES,
  MAX_NOTABLE_PER_FILE,
  MAX_PARAMETERS,
  NOTABLE_MIN_COMPLEXITY,
} from "./function-thresholds.js";

/** A function the history can follow by its name within its file. */
type NotableFunction = {
  readonly name: string;
  /** The line the function starts on, 1-based. */
  readonly line: number;
  readonly complexity: number;
  /** Non-blank lines of the function, nested functions included. */
  readonly lines: number;
};

/**
 * The functions of one file, every function including callbacks and nested
 * functions, each scored from its own body: the structures of a function
 * nested in it are the nested one's, and the function around adds no nesting
 * (the way eslint-plugin-sonarjs reports a function). Every count is
 * additive across files. Functions of 15 or more are `complexity[3]` plus
 * `complexity[4]`.
 */
export type FunctionFacts = {
  readonly count: number;
  /** Functions per complexity band `0–4`, `5–9`, `10–14`, `15–24`, `25+`. */
  readonly complexity: ReadonlyArray<number>;
  /** Functions per length band `1–15`, `16–30`, `31–60`, `61+` non-blank lines. */
  readonly lengths: ReadonlyArray<number>;
  /** How many functions have each score, as `[score, functions]` pairs in ascending score order. */
  readonly scores: ReadonlyArray<readonly [number, number]>;
  /** Non-blank lines inside the functions of 15 or more, a function inside another such function not counted again. */
  readonly hardLines: number;
  /** Functions with more than 4 parameters, a destructured parameter counting once. */
  readonly longParameterLists: number;
  /** The deepest nesting of control structures within one function. */
  readonly maxDepth: number;
  /** Functions of at least 3, hardest first and then by line, at most 40. */
  readonly notable: ReadonlyArray<NotableFunction>;
};

/** What the walk learned of one function. */
export type MeasuredFunction = NotableFunction & {
  readonly parameters: number;
  readonly depth: number;
  /** Whether a function of 15 or more contains it, so that its lines are inside those counted already. */
  readonly insideHard: boolean;
};

const byHardness = (left: NotableFunction, right: NotableFunction): number =>
  right.complexity - left.complexity || left.line - right.line;

/** The facts that the measured functions of a file add up to. */
export const functionFactsOf = (
  measured: ReadonlyArray<MeasuredFunction>,
): FunctionFacts => {
  const hard = measured.filter(
    ({ complexity, insideHard }) =>
      complexity >= COMPLEXITY_LIMIT && !insideHard,
  );
  return {
    count: measured.length,
    complexity: histogram(
      measured.map(({ complexity }) => complexity),
      COMPLEXITY_EDGES,
    ),
    lengths: histogram(
      measured.map(({ lines }) => lines),
      LENGTH_EDGES,
    ),
    scores: [...tallyOf(measured.map(({ complexity }) => complexity))].toSorted(
      ([left], [right]) => left - right,
    ),
    hardLines: hard.reduce((total, { lines }) => total + lines, 0),
    longParameterLists: measured.filter(
      ({ parameters }) => parameters > MAX_PARAMETERS,
    ).length,
    maxDepth: measured.reduce(
      (deepest, { depth }) => Math.max(deepest, depth),
      0,
    ),
    notable: measured
      .filter(({ complexity }) => complexity >= NOTABLE_MIN_COMPLEXITY)
      .map(({ name, line, complexity, lines }) => ({
        name,
        line,
        complexity,
        lines,
      }))
      .toSorted(byHardness)
      .slice(0, MAX_NOTABLE_PER_FILE),
  };
};

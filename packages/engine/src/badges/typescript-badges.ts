// Owns the territory badges that read the TypeScript deep dive: type-safe, strict, complex logic and in a cycle.
// Facts about the territory's own files; none compares it with its siblings. Only `in-a-cycle` points at a cost.

import { countOf, nounOf, percentOf } from "../report/sentences.js";
import type { TerritoryTypeScript } from "../report/typescript-territory.js";
import { TERRITORY_BADGE_THRESHOLDS } from "./territory-badge-thresholds.js";

const { typeSafeMinFiles, complexLogicMinFunctions, complexLogicShare } =
  TERRITORY_BADGE_THRESHOLDS;

/** The figure as the evidence shows it, with one decimal. */
const oneDecimal = (value: number): string =>
  (Math.round(value * 10) / 10).toFixed(1);

/** `type-safe`: enough production TypeScript files and no escape hatch per 1,000 lines once rounded to one decimal. */
export const typeSafe = (typescript: TerritoryTypeScript | undefined) => {
  const files = typescript?.productionTypeScriptFiles ?? 0;
  const rate = typescript?.escapesPer1000;
  return rate !== undefined &&
    files >= typeSafeMinFiles &&
    oneDecimal(rate) === oneDecimal(0)
    ? {
        kind: "type-safe" as const,
        label: "Type-safe",
        evidence: `${nounOf(files, "production TypeScript file")} with ${oneDecimal(rate)} escape hatches per 1,000 production lines.`,
      }
    : undefined;
};

/** `strict`: every governing config sets `strict` and `noUncheckedIndexedAccess`. */
export const strict = (typescript: TerritoryTypeScript | undefined) =>
  typescript?.strict === true && typescript.noUncheckedIndexedAccess === true
    ? {
        kind: "strict" as const,
        label: "Strict",
        evidence:
          "Every tsconfig that governs its files sets strict and noUncheckedIndexedAccess.",
      }
    : undefined;

/** `complex-logic`: enough production functions and a share of them at or above the complexity limit, decided on the counts and not on the rounded `over15Share`. */
export const complexLogic = (typescript: TerritoryTypeScript | undefined) => {
  const functions = typescript?.functions ?? 0;
  const complex = typescript?.complexFunctions ?? 0;
  return functions >= complexLogicMinFunctions &&
    complex / functions >= complexLogicShare
    ? {
        kind: "complex-logic" as const,
        label: "Complex logic",
        evidence: `${countOf(complex)} of ${nounOf(functions, "production function")} (${percentOf(complex / functions)}) score 15 or more; the hardest scores ${typescript?.maxComplexity ?? 0}.`,
      }
    : undefined;
};

/** `in-a-cycle`: a cycle of production files by value imports runs through the territory and out of it. */
export const inACycle = (typescript: TerritoryTypeScript | undefined) =>
  typescript?.inCycle === true
    ? {
        kind: "in-a-cycle" as const,
        label: "In a cycle",
        evidence:
          "Production files import each other by value in a cycle that runs through this territory and out of it.",
      }
    : undefined;

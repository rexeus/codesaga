// Owns the stories that restate the TypeScript deep dive at HEAD: a committed focused test, a hard core of functions and a territory the others import.
// Reads the report's own blocks, so a story and the dashboard say the same figures; the stories that need the history are in `typescript-trend-stories.ts`.
// Cost: one pass over the import map's edges.

import { compareCodeUnits } from "../collections/compare-code-units.js";
import { countOf, nounOf, territoryNameOf } from "../report/sentences.js";
import type { Story } from "../report/stories.js";
import type { TypeScriptDeepDive } from "../report/typescript-deep-dive.js";
import type { StoryFacts } from "./stories.js";
import { STORY_THRESHOLDS } from "./thresholds.js";

const {
  focusedTestMinCases,
  complexCoreMinFunctions,
  complexCoreMinComplexity,
  coreTerritoryShare,
  coreTerritoryMinTerritories,
} = STORY_THRESHOLDS;

const focusedTest = ({ tests }: TypeScriptDeepDive): ReadonlyArray<Story> => {
  const [first] = tests?.focusedFiles ?? [];
  if (
    tests === undefined ||
    first === undefined ||
    tests.focused < focusedTestMinCases
  ) {
    return [];
  }
  const others = tests.focusedFileCount - 1;
  const where =
    others <= 0 ? first : `${first} and ${nounOf(others, "other file")}`;
  return [
    {
      kind: "focused-test",
      title: "Focused test",
      detail: `${nounOf(tests.focused, "focused test")} committed in ${where}: the runner skips every other test while one stays.`,
      value: tests.focused,
      path: first,
    },
  ];
};

/** A share as a whole percent, "under 1%" for a share that rounds to none. */
const lineShareOf = (share: number): string =>
  share > 0 && share < 0.005 ? "under 1%" : `${Math.round(share * 100)}%`;

const complexCore = ({
  functions,
}: TypeScriptDeepDive): ReadonlyArray<Story> => {
  const production = functions?.production;
  const [hardest] = production?.top ?? [];
  if (
    production === undefined ||
    hardest === undefined ||
    production.functions < complexCoreMinFunctions ||
    hardest.complexity < complexCoreMinComplexity
  ) {
    return [];
  }
  const { over15 } = production;
  const where =
    hardest.name === "(anonymous)"
      ? `an anonymous function in ${hardest.path}:${hardest.line}`
      : `${hardest.name} in ${hardest.path}`;
  return [
    {
      kind: "complex-core",
      title: "Hard functions",
      detail: `The hardest function, ${where}, scores ${hardest.complexity}; the ${countOf(over15.functions)} of ${nounOf(production.functions, "function")} at 15 or more hold ${lineShareOf(over15.lineShare)} of the code.`,
      value: hardest.complexity,
      path: hardest.path,
    },
  ];
};

/** The named territory that the most other named territories import, with that count; a tie goes to the path first in order. */
const mostImported = ({
  territories,
}: NonNullable<TypeScriptDeepDive["imports"]>):
  | {
      readonly path: string;
      readonly importers: number;
      readonly others: number;
    }
  | undefined => {
  const named = territories.territories.filter(({ kind }) => kind !== "other");
  const importers = new Map<string, Set<string>>();
  for (const { from, to } of territories.edges) {
    if (from.kind !== "other" && to.kind !== "other" && from.path !== to.path) {
      importers.set(
        to.path,
        (importers.get(to.path) ?? new Set()).add(from.path),
      );
    }
  }
  const [top] = [...importers]
    .map(([path, from]) => ({ path, importers: from.size }))
    .toSorted(
      (a, b) => b.importers - a.importers || compareCodeUnits(a.path, b.path),
    );
  return top === undefined || named.length < coreTerritoryMinTerritories
    ? undefined
    : { ...top, others: named.length - 1 };
};

const coreTerritory = ({
  imports,
}: TypeScriptDeepDive): ReadonlyArray<Story> => {
  const core = imports === undefined ? undefined : mostImported(imports);
  if (core === undefined || core.importers < coreTerritoryShare * core.others) {
    return [];
  }
  return [
    {
      kind: "core-territory",
      title: "Core territory",
      detail: `${territoryNameOf(core.path, true)} is imported by ${core.importers} of ${nounOf(core.others, "other territory", "other territories")}.`,
      value: core.importers,
      path: core.path,
    },
  ];
};

/**
 * The `focused-test`, `complex-core` and `core-territory` findings that pass
 * their thresholds. `focused-test` needs a focused case in the test files;
 * `complex-core` needs at least `complexCoreMinFunctions` production functions
 * and a hardest one of at least `complexCoreMinComplexity`; `core-territory`
 * needs at least `coreTerritoryMinTerritories` named territories in the import
 * map and one that at least `coreTerritoryShare` of the others import. Without
 * the deep dive there are none.
 */
export const typescriptStories = ({
  typescript,
}: StoryFacts): ReadonlyArray<Story> =>
  typescript === undefined
    ? []
    : [
        ...focusedTest(typescript),
        ...complexCore(typescript),
        ...coreTerritory(typescript),
      ];

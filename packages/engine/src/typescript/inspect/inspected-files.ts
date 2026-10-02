// Owns the TypeScript figures of one `inspect` argument: complexity and escape hatches of the matched files, and who imports and tests them.
// Pure over the parsed files and the import graph the gathering built, so the figures are the deep dive's own.

import type { InspectTypeScript } from "../../report/inspect-typescript.js";
import type { TerritoryStrict } from "../../report/typescript-strictness.js";
import { sum } from "../../stats/measures.js";
import { COMPLEXITY_LIMIT } from "../functions/function-thresholds.js";
import type { ImportGraph } from "../imports/import-graph.js";
import type { ParsedFile } from "../parsed-file.js";
import { isScriptPath } from "../source-kinds.js";
import { escapesOf } from "../type-safety/type-safety-report.js";

const MAX_HARDEST = 3;
const MAX_LISTED = 5;

/** What the gathering knows of the files around the matched ones. */
export type InspectedTypeScript = {
  /** The parsed files by path: the matched ones and the files that may import them. */
  readonly parsed: ReadonlyMap<string, ParsedFile>;
  /** The graph over every TypeScript and JavaScript file, with the edges of the parsed ones. */
  readonly graph: ImportGraph;
  readonly strictOf: (
    paths: ReadonlyArray<string>,
  ) => TerritoryStrict | undefined;
};

const sortedList = (
  paths: ReadonlySet<string>,
): InspectTypeScript["importedBy"] => ({
  files: paths.size,
  top: [...paths].toSorted().slice(0, MAX_LISTED),
});

/** The files that import a matched production file: others than the matched ones for `importedBy`, test files for `testedBy`. */
const importersOf = (
  { graph }: InspectedTypeScript,
  matched: ReadonlySet<string>,
) => {
  const importedBy = new Set<string>();
  const testedBy = new Set<string>();
  for (const { from, to } of graph.edges) {
    const target = graph.paths[to];
    const source = graph.paths[from];
    if (
      target === undefined ||
      source === undefined ||
      !matched.has(target) ||
      graph.isTest[to] === true
    ) {
      continue;
    }
    if (graph.isTest[from] === true) {
      testedBy.add(source);
    } else if (!matched.has(source)) {
      importedBy.add(source);
    }
  }
  return { importedBy: sortedList(importedBy), testedBy: sortedList(testedBy) };
};

const hardestOf = (files: ReadonlyArray<ParsedFile>) =>
  files
    .flatMap(({ path, facts }) =>
      facts.functions.notable
        .filter(({ complexity }) => complexity >= COMPLEXITY_LIMIT)
        .map(({ name, line, complexity }) => ({
          name,
          path,
          line,
          complexity,
        })),
    )
    .toSorted(
      (a, b) =>
        b.complexity - a.complexity ||
        a.path.localeCompare(b.path) ||
        a.line - b.line,
    );

/**
 * What the deep dive says of the TypeScript and JavaScript files among
 * `matched`; undefined when there is none. Files without facts (declaration
 * files and skipped ones) are counted as `unparsed`.
 */
export const inspectTypeScriptOf = (
  inspected: InspectedTypeScript,
  matched: ReadonlyArray<string>,
): InspectTypeScript | undefined => {
  const paths = matched.filter((path) => isScriptPath(path));
  if (paths.length === 0) {
    return undefined;
  }
  const files = paths.flatMap((path) => inspected.parsed.get(path) ?? []);
  const hard = hardestOf(files);
  const strict = inspected.strictOf(paths);
  return {
    files: files.length,
    unparsed: paths.length - files.length,
    maxComplexity: files.reduce(
      (max, { facts }) =>
        Math.max(max, facts.functions.scores.at(-1)?.[0] ?? 0),
      0,
    ),
    complexFunctions: sum(
      files.map(({ facts }) => sum(facts.functions.complexity.slice(-2))),
    ),
    hardest: hard.slice(0, MAX_HARDEST),
    escapes: sum(files.map(({ facts }) => escapesOf(facts.typeSafety))),
    directives: sum(
      files.map(
        ({ facts: { typeSafety } }) =>
          typeSafety.tsIgnore + typeSafety.tsExpectError + typeSafety.tsNocheck,
      ),
    ),
    ...importersOf(inspected, new Set(paths)),
    ...(strict === undefined ? {} : { strict }),
  };
};

import type { TypeScriptDeepDive } from "../report/typescript-deep-dive.js";
import type {
  Functions,
  FunctionsPart,
} from "../report/typescript-functions.js";
// Tests only: complete blocks of the TypeScript deep dive with chosen figures, so a test states only what its rule reads.
import type { Imports } from "../report/typescript-imports.js";
import type { Strictness } from "../report/typescript-strictness.js";
import type { Tests } from "../report/typescript-tests.js";

/** A parsed repository's coverage; the blocks below join it. */
const COVERAGE: TypeScriptDeepDive["coverage"] = {
  files: 10,
  parsed: 10,
  declarationFiles: 0,
  skipped: {},
  parser: { name: "oxc-parser", version: "9.9.9" },
};

/** The deep dive with `coverage` and the given blocks. */
export const deepDiveWith = (
  blocks: Omit<TypeScriptDeepDive, "coverage">,
): TypeScriptDeepDive => ({ coverage: COVERAGE, ...blocks });

/** Test figures with no case, apart from `overrides`. */
export const testsBlock = (overrides: Partial<Tests> = {}): Tests => ({
  files: 0,
  frameworks: [],
  cases: 0,
  parameterized: 0,
  skipped: 0,
  focused: 0,
  todo: 0,
  focusedFiles: [],
  focusedFileCount: 0,
  assertions: [0, 0, 0, 0],
  snapshots: 0,
  typeTests: 0,
  ...overrides,
});

/** Function figures of one set of files, apart from `overrides`. */
export const functionsPart = (
  overrides: Partial<FunctionsPart> = {},
): FunctionsPart => ({
  files: 0,
  codeLines: 0,
  functions: 0,
  complexity: { bands: [0, 0, 0, 0, 0], p50: 0, p90: 0, max: 0 },
  over15: { functions: 0, share: 0, lines: 0, lineShare: 0 },
  top: [],
  lengths: [0, 0, 0, 0],
  longParameterLists: 0,
  maxDepth: 0,
  ...overrides,
});

/** Function figures of production code and none of tests. */
export const functionsBlock = (
  production: Partial<FunctionsPart>,
): Functions => ({
  production: functionsPart(production),
  tests: functionsPart(),
});

/** Strictness with the given configs and no file outside them. */
export const strictnessBlock = (
  configs: Strictness["configs"],
  overrides: Partial<Strictness> = {},
): Strictness => ({
  typescript: { declared: "^5.9.2", strictByDefault: false },
  configs,
  totalConfigs: configs.length,
  governedFiles: configs.reduce((sum, { files }) => sum + files, 0),
  ungovernedFiles: 0,
  jsFilesOutsideConfigs: 0,
  ...overrides,
});

/** One config with the given governed files and `strict`; its other options are off. */
export const configPosture = (
  path: string,
  files: number,
  strict: boolean,
): Strictness["configs"][number] => ({
  path,
  extends: [],
  unresolved: [],
  files,
  strict,
  strictExceptions: [],
  noUncheckedIndexedAccess: false,
  exactOptionalPropertyTypes: false,
  noImplicitOverride: false,
  verbatimModuleSyntax: false,
  isolatedModules: false,
  allowJs: false,
  checkJs: false,
  target: null,
  module: null,
  moduleResolution: null,
});

type ImportMap = Imports["territories"];

const refOf = (path: string) => ({ path, kind: "package" as const });

/** An import map over the named territories (kind `package`) with `edges` as `[from, to]` pairs. */
export const importsBlock = (
  territories: ReadonlyArray<string>,
  edges: ReadonlyArray<readonly [string, string]>,
): Imports => {
  const map: ImportMap = {
    detail: 1,
    totalTerritories: territories.length,
    territories: territories.map((path) => ({
      ...refOf(path),
      files: 5,
      ca: 0,
      ce: 0,
    })),
    totalEdges: edges.length,
    edges: edges.map(([from, to]) => ({
      from: refOf(from),
      to: refOf(to),
      files: 1,
      typeOnlyFiles: 0,
    })),
    totalTowardLessStable: 0,
    towardLessStable: [],
    totalMutualImports: 0,
    mutualImports: [],
    mutualImportsWithTypes: 0,
  };
  return {
    files: {
      files: 50,
      testFiles: 0,
      edges: { value: 0, typeOnly: 0, tests: 0 },
      external: 0,
      assets: 0,
      dynamicUnresolvable: 0,
      unresolved: { count: 0, share: 0, top: [] },
      cycles: {
        count: 0,
        largest: 0,
        top: [],
        withTypes: { count: 0, largest: 0 },
        typeOnly: 0,
      },
      fanIn: { median: 0, top: [] },
      fanOut: { top: [] },
    },
    territories: map,
  };
};

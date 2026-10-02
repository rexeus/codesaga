// Owns the shape of `deepDives.typescript.imports`: how the code depends on itself, between files and between territories.
// Counts and measures of the import graph; a cycle or an instability describes the code and never judges it.
import { Schema } from "effect";

const Count = Schema.Natural;
const Share = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }));

/** A territory as the map names it: `path` and `kind` identify it among the territories of one detail. */
export const TerritoryRef = Schema.Struct({
  path: Schema.String,
  kind: Schema.Literals(["package", "folder", "other"]),
});
export type TerritoryRef = typeof TerritoryRef.Type;

const FileCount = Schema.Struct({ path: Schema.String, count: Count });

/** Files that import each other, directly or through others, by value edges. */
const Cycle = Schema.Struct({
  /** Files in the cycle. */
  size: Count,
  /** The first ten of them, in path order. */
  files: Schema.Array(Schema.String).check(Schema.isMaxLength(10)),
  /** Territories of the map the files lie in. */
  territories: Count,
});

/**
 * Import cycles. A cycle is a set of production files that all reach each
 * other by imports, or a file that imports itself; every figure but
 * `withTypes` follows value edges only, since an `import type` is erased and
 * costs nothing at runtime. Test files take no part.
 */
const Cycles = Schema.Struct({
  /** Cycles by value edges, each one maximal: a file is in at most one. */
  count: Count,
  /** Files in the largest; 0 without a cycle. */
  largest: Count,
  /** The three largest, largest first. */
  top: Schema.Array(Cycle).check(Schema.isMaxLength(3)),
  /** The cycles, and the files in the largest, when type-only edges count too. */
  withTypes: Schema.Struct({ count: Count, largest: Count }),
  /** Cycles that exist only through type-only edges: none of their files is in a cycle by value edges. */
  typeOnly: Count,
});

/** The specifiers that point into the repository where no file could be found. */
const Unresolved = Schema.Struct({
  count: Count,
  /** `count` over the specifiers that point into the repository, resolved or not; 0 without any. */
  share: Share,
  /** The five specifiers that the most files name, most first. */
  top: Schema.Array(
    Schema.Struct({ specifier: Schema.String, files: Count }),
  ).check(Schema.isMaxLength(5)),
});

/**
 * The import graph of the TypeScript and JavaScript files at HEAD: a node
 * per file and an edge per pair where one imports the other. A specifier
 * counts once per file that names it. Tests are nodes, but fan-in, fan-out
 * and cycles count production files and their edges only.
 */
const FileImports = Schema.Struct({
  /** Production files, and test files, in the graph; declaration files count as production. */
  files: Count,
  testFiles: Count,
  /** Edges between production files by value and by type only, and edges that touch a test file. */
  edges: Schema.Struct({ value: Count, typeOnly: Count, tests: Count }),
  /** Specifiers that name a package or built-in outside the repository, counted and not resolved. */
  external: Count,
  /** Specifiers that name a file that is not code, such as a style sheet, an image or JSON. */
  assets: Count,
  unresolved: Unresolved,
  cycles: Cycles,
  /** Files that import each file: the median over production files, and the five with the most, most first. */
  fanIn: Schema.Struct({
    median: Schema.Finite,
    top: Schema.Array(FileCount).check(Schema.isMaxLength(5)),
  }),
  /** Files each file imports: the five with the most, most first. */
  fanOut: Schema.Struct({
    top: Schema.Array(FileCount).check(Schema.isMaxLength(5)),
  }),
});

/** A territory of the map with its coupling. */
const MapTerritory = Schema.Struct({
  ...TerritoryRef.fields,
  /** Production TypeScript and JavaScript files in it. */
  files: Count,
  /** Afferent coupling: import edges from files of other territories into this one. */
  ca: Count,
  /** Efferent coupling: import edges from this territory into files of other territories. */
  ce: Count,
  /** Robert C. Martin's instability `ce / (ca + ce)`: 0 for a territory others build on, 1 for one that only builds on others. Absent without any edge. */
  instability: Schema.optionalKey(Share),
});

/** Import edges from the files of one territory into those of another. */
const MapEdge = Schema.Struct({
  from: TerritoryRef,
  to: TerritoryRef,
  /** File pairs, `from` importing `to`. */
  files: Count,
  /** Of them, the pairs that import only types. */
  typeOnlyFiles: Count,
});

/** An edge from a territory toward one that is less stable than itself. */
const TowardLessStable = Schema.Struct({
  from: TerritoryRef,
  to: TerritoryRef,
  files: Count,
  fromInstability: Share,
  toInstability: Share,
});

/**
 * Which territory imports which, at the detail the report opens at
 * (`knowledge.territories.detail`), with test files left out. Counts are in
 * import edges between files, not in files. `other` territories take part as
 * nodes and edges but are not judged: they appear in neither
 * `towardLessStable` nor `cycles`.
 */
const TerritoryMap = Schema.Struct({
  detail: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /** The territories before the output limit cut `territories`. */
  totalTerritories: Count,
  /** Every territory of that detail, those with the most edges first. */
  territories: Schema.Array(MapTerritory),
  /** The edges before the output limit cut `edges`. */
  totalEdges: Count,
  /** Territory pairs with their file counts, the most files first. */
  edges: Schema.Array(MapEdge),
  /** Edges toward a territory whose instability is at least `thresholds.typescript.imports.instabilityGap` higher, between territories that each have at least `thresholds.typescript.imports.minEdges` edges. */
  towardLessStable: Schema.Array(TowardLessStable),
  /** Groups of territories that all reach each other by value edges, in path order. */
  cycles: Schema.Array(
    Schema.Struct({ territories: Schema.Array(TerritoryRef) }),
  ),
  /** Cycles between territories when type-only edges count too. */
  cyclesWithTypes: Count,
});

/** How the code depends on itself. Absent when no file was parsed. */
export const Imports = Schema.Struct({
  files: FileImports,
  territories: TerritoryMap,
});
export type Imports = typeof Imports.Type;

/** What the import edges say of one territory; the territory's `typescript` carries these fields. */
export type TerritoryImports = {
  readonly imports: ReadonlyArray<TerritoryRef>;
  readonly importedBy: ReadonlyArray<TerritoryRef>;
  readonly inCycle: boolean;
};

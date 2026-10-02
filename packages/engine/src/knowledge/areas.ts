// @scaffold Owns cutting the universe into areas: package roots, the partition per level and the "other files" groups.
// @scaffold Sits beside `directories.ts`, which it replaces in the report; `directories` stays for schemaVersion 1.
// @scaffold Cost: one pass over the files per level, at most `MAX_AREA_DEPTH` levels; the knowledge of each area is described once.

import type { AreaKnowledge, AreaLevel } from "../report/knowledge-report.js";
import type { KnowledgeModel } from "./model.js";

/** An area with fewer universe files is grouped with its siblings as "other files". */
export const AREA_MIN_FILES = 3;

/** The deepest level reported. */
export const MAX_AREA_DEPTH = 6;

/** An area with the universe files it holds, which the badges need and the report leaves out. */
export type AreaWithFiles = Omit<AreaKnowledge, "badges"> & {
  /** The area's universe files, repository-relative. */
  readonly paths: ReadonlyArray<string>;
};

/** One level of the partition. */
export type AreaLevelWithFiles = Omit<AreaLevel, "areas"> & {
  readonly areas: ReadonlyArray<AreaWithFiles>;
};

export type AreaInput = {
  /** The universe files of the scope. */
  readonly paths: ReadonlyArray<string>;
  /** From `packageRootsOf`; a root equal to the scope or above it (such as the repository root) is not a package here. */
  readonly packageRoots: ReadonlyArray<string>;
  /** Repository-relative scope; "." for the whole repository. */
  readonly scope: string;
  readonly model: KnowledgeModel;
};

/**
 * The directories that hold a package manifest (`package.json`, `Cargo.toml`,
 * `go.mod`, `pyproject.toml`, `setup.py`, `pom.xml`, `build.gradle(.kts)`,
 * `*.csproj`, `composer.json`, `Gemfile`, `mix.exs`, `deno.json`), sorted.
 * `trackedPaths` are all tracked files, manifests included, though they are
 * not code. The repository root is a root like any other.
 */
export const packageRootsOf = (
  trackedPaths: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  throw new Error(`not implemented: ${trackedPaths.length}`);
};

/**
 * The partition of the universe at levels 1 to the deepest useful one, at
 * most `MAX_AREA_DEPTH`: the level after which no area changes is the last.
 * Each file belongs to exactly one area per level. Level 1 is the package
 * roots, or the directories below the scope without any; level k is k-1
 * directory steps below a package root; a file outside every package is cut k
 * directory steps below the scope. A file directly in a root belongs to that
 * root's own area. Areas with fewer than `AREA_MIN_FILES` files are
 * grouped per parent as one `rest` area. Areas are ordered riskiest first like
 * `directoryKnowledge`. Always returns level 1, with no areas for no files.
 */
export const areaLevels = (
  input: AreaInput,
): ReadonlyArray<AreaLevelWithFiles> => {
  throw new Error(`not implemented: ${input.paths.length}`);
};

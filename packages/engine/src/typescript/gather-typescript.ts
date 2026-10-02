// Owns reading the universe's TypeScript and JavaScript files at HEAD and handing them to the parser.
// Sources come from the work tree, like the universe, so facts match the code stats including uncommitted edits.

import { Array as Arr, Effect, FileSystem, Path } from "effect";

import type { InventoryFile } from "../universe/inventory.js";
import { readManifests } from "./ecosystem/read-manifests.js";
import type { PackageManifest } from "./ecosystem/read-manifests.js";
import type { FactsResult, SourceText } from "./facts-of-source.js";
import { isDeclarationPath, isScriptPath } from "./source-kinds.js";
import { readTsconfigs } from "./tsconfig/read-tsconfigs.js";
import type { TsconfigProject } from "./tsconfig/strictness.js";
import { declaredTypeScript } from "./tsconfig/typescript-version.js";
import { TypeScriptParser } from "./typescript-parser.js";
import type { ParserStatus } from "./typescript-parser.js";

/** What the parser made of the universe's TypeScript and JavaScript files. */
export type TypeScriptFacts = {
  readonly status: ParserStatus;
  /** Declaration files, which are counted and not parsed. */
  readonly declarationFiles: ReadonlyArray<string>;
  /** The `package.json` files of the repository. */
  readonly manifests: ReadonlyArray<PackageManifest>;
  /** The `tsconfig` files and the declared TypeScript version. */
  readonly project: TsconfigProject;
  /** Every other file with its verdict and the non-blank lines the universe measured for it. */
  readonly files: ReadonlyArray<{
    readonly path: string;
    readonly lines: number;
    readonly result: FactsResult;
  }>;
};

/** Files read and parsed per step; bounds the text held at once. The parser spreads a step over its processes. */
const BATCH_SIZE = 2_000;
/** Files read at once within a step; bounds open file handles. */
const READ_CONCURRENCY = 16;

const UNREADABLE: FactsResult = { kind: "skipped", reason: "unreadable" };

const readSource = (
  root: string,
  file: string,
): Effect.Effect<
  SourceText | undefined,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const text = yield* fs.readFileString(path.join(root, file));
    return { path: file, text };
  }).pipe(Effect.orElseSucceed(() => undefined));

const verdicts = (
  root: string,
  paths: ReadonlyArray<string>,
  parser: TypeScriptParser["Service"],
  linesOf: (path: string) => number,
) =>
  Effect.gen(function* () {
    const sources = yield* Effect.forEach(
      paths,
      (file) => readSource(root, file),
      {
        concurrency: READ_CONCURRENCY,
      },
    );
    const readable = sources.filter((source) => source !== undefined);
    const facts = yield* parser.factsOf(readable);
    const judged = Arr.zip(readable, facts).map(([source, result]) => ({
      path: source.path,
      lines: linesOf(source.path),
      result,
    }));
    const unreadable = paths
      .filter((_, index) => sources[index] === undefined)
      .map((path) => ({ path, lines: linesOf(path), result: UNREADABLE }));
    return [...judged, ...unreadable];
  });

const TSCONFIG_NAME = /(?:^|\/)tsconfig(?:\.[^/]+)?\.json$/u;

const readText = (
  root: string,
  file: string,
): Effect.Effect<
  string | undefined,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return yield* fs.readFileString(path.join(root, file));
  }).pipe(Effect.orElseSucceed(() => undefined));

/** The configs among the tracked files, read with their `extends`, and the TypeScript the root manifest declares. */
const readProject = (
  root: string,
  tracked: ReadonlyArray<string>,
): Effect.Effect<TsconfigProject, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const configs = yield* readTsconfigs(
      root,
      tracked.filter((path) => TSCONFIG_NAME.test(path)),
    );
    const manifest = yield* readText(root, "package.json");
    const workspace = yield* readText(root, "pnpm-workspace.yaml");
    return { configs, typescript: declaredTypeScript(manifest, workspace) };
  });

/**
 * Reads the universe's TypeScript and JavaScript files below `root` and
 * parses them, or returns undefined when the universe has none, in which case
 * the parser is not even asked to load. Never fails: an unreadable file is
 * skipped as `unreadable`, and the parser's own failures are its verdicts.
 */
export const gatherTypeScript = (
  root: string,
  universe: ReadonlyArray<InventoryFile>,
  tracked: ReadonlyArray<string>,
): Effect.Effect<
  TypeScriptFacts | undefined,
  never,
  TypeScriptParser | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const scripts = universe
      .map(({ path }) => path)
      .filter((path) => isScriptPath(path));
    if (scripts.length === 0) {
      return undefined;
    }
    const parser = yield* TypeScriptParser;
    const declarationFiles = scripts.filter((path) => isDeclarationPath(path));
    const parsable = scripts.filter((path) => !isDeclarationPath(path));
    const lines = new Map(universe.map(({ path, loc }) => [path, loc]));
    const batches = yield* Effect.forEach(
      Arr.chunksOf(parsable, BATCH_SIZE),
      (paths) => verdicts(root, paths, parser, (path) => lines.get(path) ?? 0),
    );
    return {
      status: yield* parser.status,
      declarationFiles,
      project: yield* readProject(root, tracked),
      manifests: yield* readManifests(root, tracked),
      files: batches.flat(),
    };
  });

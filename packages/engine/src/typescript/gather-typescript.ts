// Owns reading the universe's TypeScript and JavaScript files at HEAD and handing them to the parser.
// Sources come from the work tree, like the universe, so facts match the code stats including uncommitted edits.

import { Array as Arr, Effect, FileSystem, Path } from "effect";

import type { InventoryFile } from "../universe/inventory.js";
import type { FactsResult, SourceText } from "./facts-of-source.js";
import { isDeclarationPath, isScriptPath } from "./source-kinds.js";
import { TypeScriptParser } from "./typescript-parser.js";
import type { ParserStatus } from "./typescript-parser.js";

/** What the parser made of the universe's TypeScript and JavaScript files. */
export type TypeScriptFacts = {
  readonly status: ParserStatus;
  /** Declaration files, which are counted and not parsed. */
  readonly declarationFiles: ReadonlyArray<string>;
  /** Every other file with its verdict. */
  readonly files: ReadonlyArray<{
    readonly path: string;
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
      result,
    }));
    const unreadable = paths
      .filter((_, index) => sources[index] === undefined)
      .map((path) => ({ path, result: UNREADABLE }));
    return [...judged, ...unreadable];
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
    const batches = yield* Effect.forEach(
      Arr.chunksOf(parsable, BATCH_SIZE),
      (paths) => verdicts(root, paths, parser),
    );
    return {
      status: yield* parser.status,
      declarationFiles,
      files: batches.flat(),
    };
  });

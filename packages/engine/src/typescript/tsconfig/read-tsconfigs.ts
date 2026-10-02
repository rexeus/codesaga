// Owns finding and reading `tsconfig` files with their `extends` chains, through the FileSystem and Path services.
// An `extends` that cannot be found, such as an npm preset that is not installed, stays unresolved: the report says so and never guesses what it would have set.

import { Effect, FileSystem, Path } from "effect";

import { parseTsconfig } from "./config-file.js";
import type { ExtendsRef, LoadedTsconfig } from "./config-file.js";
import { directoryOf } from "./posix-path.js";

/** A longer `extends` chain is cut: nothing real is that deep, and a cycle ends sooner. */
const MAX_EXTENDS_DEPTH = 10;

/** What reading needs, and the configs read so far; an entry that is undefined is a config that was not found or is being read. */
type Reader = {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly root: string;
  readonly cache: Map<string, LoadedTsconfig | undefined>;
};

const isRelativeSpecifier = (specifier: string): boolean =>
  specifier.startsWith(".") || specifier.startsWith("/");

/** The directories from `directory` up to `root`, nearest first. */
const ancestorsWithin = (
  { path, root }: Reader,
  directory: string,
): ReadonlyArray<string> => {
  const directories = [directory];
  for (
    let current = directory;
    current !== root && current !== path.dirname(current);
    current = path.dirname(current)
  ) {
    directories.push(path.dirname(current));
  }
  return directories;
};

/** The files an `extends` specifier may name, best first: a relative path as written or with `.json`, a package from the nearest `node_modules`. */
const candidatesOf = (
  reader: Reader,
  directory: string,
  specifier: string,
): ReadonlyArray<string> => {
  const { path } = reader;
  if (isRelativeSpecifier(specifier)) {
    const base = path.resolve(directory, specifier);
    return [base, `${base}.json`];
  }
  return ancestorsWithin(reader, directory).flatMap((ancestor) => {
    const base = path.join(ancestor, "node_modules", specifier);
    return [base, `${base}.json`, path.join(base, "tsconfig.json")];
  });
};

const resolveExtends = (
  reader: Reader,
  directory: string,
  specifier: string,
  depth: number,
): Effect.Effect<ExtendsRef> =>
  Effect.gen(function* () {
    for (const candidate of candidatesOf(reader, directory, specifier)) {
      const config = yield* loadConfig(reader, candidate, depth);
      if (config !== undefined) {
        return { specifier, config };
      }
    }
    return { specifier, config: undefined };
  });

const loadConfig = (
  reader: Reader,
  absolute: string,
  depth: number,
): Effect.Effect<LoadedTsconfig | undefined> =>
  Effect.gen(function* () {
    const { fs, path, root, cache } = reader;
    if (cache.has(absolute)) {
      return cache.get(absolute);
    }
    // A config that extends itself, directly or not, finds this marker and stops.
    cache.set(absolute, undefined);
    const text = yield* fs
      .readFileString(absolute)
      .pipe(Effect.orElseSucceed(() => undefined));
    const raw = text === undefined ? undefined : parseTsconfig(text);
    if (raw === undefined) {
      return undefined;
    }
    const refs = yield* Effect.forEach(raw.extends, (specifier) =>
      depth >= MAX_EXTENDS_DEPTH
        ? Effect.succeed<ExtendsRef>({ specifier, config: undefined })
        : resolveExtends(reader, path.dirname(absolute), specifier, depth + 1),
    );
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    const loaded: LoadedTsconfig = {
      ...raw,
      path: relative,
      directory: directoryOf(relative),
      extends: refs,
    };
    cache.set(absolute, loaded);
    return loaded;
  });

/**
 * Reads the config at each of `tsconfigPaths` (repository-relative) below
 * `root`, in the order given, following `extends` through relative paths and
 * `node_modules` packages. A file that cannot be read or parsed is left out.
 */
export const readTsconfigs = (
  root: string,
  tsconfigPaths: ReadonlyArray<string>,
): Effect.Effect<
  ReadonlyArray<LoadedTsconfig>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const reader: Reader = {
      fs: yield* FileSystem.FileSystem,
      path: yield* Path.Path,
      root,
      cache: new Map(),
    };
    const configs = yield* Effect.forEach(tsconfigPaths, (tsconfigPath) =>
      loadConfig(reader, reader.path.join(root, tsconfigPath), 0),
    );
    return configs.filter((config) => config !== undefined);
  });

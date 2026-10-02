// Owns finding and reading `tsconfig` files with their `extends` chains, through the FileSystem and Path services.
// A bare `extends` resolves through the repository's own workspace packages first and `node_modules` second, and never leaves the repository. One that cannot be found, such as an npm preset that is not installed, stays unresolved: the report says so and never guesses what it would have set.

import { Effect, FileSystem, Path } from "effect";

import { parseTsconfig } from "./config-file.js";
import type { ExtendsRef, LoadedTsconfig } from "./config-file.js";
import { parseJsonc } from "./jsonc.js";
import { entryCandidates, splitPackageSpecifier } from "./package-entry.js";
import { directoryOf } from "./posix-path.js";

/** A longer `extends` chain is cut: nothing real is that deep, and a cycle ends sooner. */
const MAX_EXTENDS_DEPTH = 10;

/** The workspace packages of the repository: the package name and the repository-relative directory of its manifest. */
export type WorkspacePackages = ReadonlyMap<string, string>;

/** What reading needs, and the configs read so far; an entry that is undefined is a config that was not found or is being read. */
type Reader = {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  /** The repository root with symlinks resolved, so real paths can be compared with it. */
  readonly root: string;
  readonly workspaces: WorkspacePackages;
  readonly cache: Map<string, LoadedTsconfig | undefined>;
};

const isRelativeSpecifier = (specifier: string): boolean =>
  specifier.startsWith(".") || specifier.startsWith("/");

/** The directories from `directory` up to the root, nearest first. */
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

/** Whether the absolute path lies in the repository. */
const isInside = ({ path, root }: Reader, absolute: string): boolean => {
  const relative = path.relative(root, absolute);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
};

/** The directories a package may be found in: the repository's own workspace package, then each `node_modules` up to the root. */
const packageDirectories = (
  reader: Reader,
  directory: string,
  name: string,
): ReadonlyArray<string> => {
  const { path, root, workspaces } = reader;
  const workspace = workspaces.get(name);
  return [
    ...(workspace === undefined ? [] : [path.join(root, workspace)]),
    ...ancestorsWithin(reader, directory).map((ancestor) =>
      path.join(ancestor, "node_modules", name),
    ),
  ];
};

const readManifest = (
  reader: Reader,
  packageDirectory: string,
): Effect.Effect<unknown> =>
  reader.fs
    .readFileString(reader.path.join(packageDirectory, "package.json"))
    .pipe(
      Effect.map((text) => parseJsonc(text)),
      Effect.orElseSucceed(() => undefined),
    );

/** The files an `extends` specifier may name, best first: a relative path as written or with `.json`, a package's entry by its manifest. */
const candidatesOf = (
  reader: Reader,
  directory: string,
  specifier: string,
): Effect.Effect<ReadonlyArray<string>> =>
  Effect.gen(function* () {
    const { path } = reader;
    if (isRelativeSpecifier(specifier)) {
      const base = path.resolve(directory, specifier);
      return [base, `${base}.json`];
    }
    const { name, subpath } = splitPackageSpecifier(specifier);
    const candidates: Array<string> = [];
    for (const packageDirectory of packageDirectories(
      reader,
      directory,
      name,
    )) {
      const manifest = yield* readManifest(reader, packageDirectory);
      for (const entry of entryCandidates(manifest, subpath)) {
        candidates.push(path.join(packageDirectory, entry));
      }
    }
    return candidates;
  });

const resolveExtends = (
  reader: Reader,
  directory: string,
  specifier: string,
  depth: number,
): Effect.Effect<ExtendsRef> =>
  Effect.gen(function* () {
    for (const candidate of yield* candidatesOf(reader, directory, specifier)) {
      const config = yield* loadConfig(reader, candidate, depth);
      if (config !== undefined) {
        return { specifier, config };
      }
    }
    return { specifier, config: undefined };
  });

/** The config at `candidate`, followed through symlinks; one that is missing, unreadable or outside the repository is undefined. */
const loadConfig = (
  reader: Reader,
  candidate: string,
  depth: number,
): Effect.Effect<LoadedTsconfig | undefined> =>
  Effect.gen(function* () {
    const { fs, path, root, cache } = reader;
    const absolute = yield* fs
      .realPath(candidate)
      .pipe(Effect.orElseSucceed(() => undefined));
    if (absolute === undefined || !isInside(reader, absolute)) {
      return undefined;
    }
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
 * `root`, in the order given, following `extends` through relative paths,
 * the repository's `workspaces` and `node_modules` packages, in that order
 * for a package. A config or an `extends` target outside the repository, as
 * a symlink or a `..` path can reach, counts as not found. A file that cannot
 * be read or parsed is left out.
 */
export const readTsconfigs = (
  root: string,
  tsconfigPaths: ReadonlyArray<string>,
  workspaces: WorkspacePackages,
): Effect.Effect<
  ReadonlyArray<LoadedTsconfig>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const realRoot = yield* fs
      .realPath(root)
      .pipe(Effect.orElseSucceed(() => root));
    const reader: Reader = {
      fs,
      path: yield* Path.Path,
      root: realRoot,
      workspaces,
      cache: new Map(),
    };
    const configs = yield* Effect.forEach(tsconfigPaths, (tsconfigPath) =>
      loadConfig(reader, reader.path.join(realRoot, tsconfigPath), 0),
    );
    return configs.filter((config) => config !== undefined);
  });

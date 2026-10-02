// Owns where codesaga keeps its caches and how a cache file is replaced.
// A cache is an optimization only: nothing here fails the run.
import { Clock, Effect, FileSystem, Option, Path } from "effect";
import type { PlatformError } from "effect";

import { Git } from "../git/git.js";

/**
 * The cache file `name` of the repository `Git` runs in, inside its git directory so
 * that git never tracks it, or undefined when git cannot say where that is.
 *
 * Runs git inside `root`, so the `Git` service must be built for it.
 */
export const cacheFile = (
  root: string,
  name: string,
): Effect.Effect<string | undefined, never, Git | Path.Path> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const path = yield* Path.Path;
    const common = yield* git.text(["rev-parse", "--git-common-dir"]);
    return path.join(path.resolve(root, common.trim()), "codesaga", name);
  }).pipe(Effect.orElseSucceed(() => undefined));

/** A temporary file this old belongs to a run that died; a younger one may belong to a live run. */
const STALE_TEMPORARY_MS = 60 * 60 * 1000;

/** Removes the temporary files of `file` that a run which died left behind. */
const removeStaleTemporaries = (
  file: string,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const now = yield* Clock.currentTimeMillis;
    const directory = path.dirname(file);
    const isTemporary = (name: string) =>
      name.startsWith(`${path.basename(file)}.`) && name.endsWith(".tmp");
    const removeIfStale = (name: string) =>
      Effect.gen(function* () {
        const { mtime } = yield* fs.stat(path.join(directory, name));
        if (
          Option.isSome(mtime) &&
          now - mtime.value.getTime() > STALE_TEMPORARY_MS
        ) {
          yield* fs.remove(path.join(directory, name), { force: true });
        }
      }).pipe(Effect.ignore);
    const names = yield* fs.readDirectory(directory);
    yield* Effect.forEach(
      names.filter((name) => isTemporary(name)),
      removeIfStale,
    );
  }).pipe(Effect.ignore);

/**
 * Replaces `file` with `text` atomically, so a concurrent run sees the old or
 * the new file, never a torn one. A failure leaves the old file in place and
 * fails. Temporary files of runs that died over an hour ago are removed on the way.
 */
export const writeFileAtomically = (
  file: string,
  text: string,
): Effect.Effect<
  void,
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* removeStaleTemporaries(file);
    yield* fs.writeFileString(temporary, text).pipe(
      Effect.andThen(fs.rename(temporary, file)),
      Effect.tapError(() =>
        fs.remove(temporary, { force: true }).pipe(Effect.ignore),
      ),
    );
  });

// Owns finding `.codesaga.json` in a repository root and reading it.
import { ByteSize, Effect, FileSystem, Option, Path, Result } from "effect";
import type { PlatformError } from "effect";

import { ConfigInvalid } from "../errors/config-invalid.js";
import { decodeRepoConfig } from "./repo-config.js";
import type { RepoConfig } from "./repo-config.js";

const CONFIG_FILE = ".codesaga.json";

/** A repository's config file with its location, for messages that name it. */
type LoadedConfig = {
  readonly file: string;
  readonly config: RepoConfig;
};

const MAX_BYTES = ByteSize.mebibytes(1);

const invalid = (file: string, problem: string) =>
  new ConfigInvalid({ file, problems: [problem] });

/** Names the reason a platform call failed without the path, which the message already leads with. */
const cannotRead = (file: string, error: PlatformError.PlatformError) =>
  invalid(file, `cannot be read (${error.reason._tag})`);

/**
 * The config file's metadata, or none when there is no file. A symbolic link
 * to a missing file is not "no file": the repository meant to have a config.
 */
const statConfig = (fs: FileSystem.FileSystem, file: string) =>
  fs.stat(file).pipe(
    Effect.asSome,
    Effect.catchIf(
      (error) => error.reason._tag === "NotFound",
      () =>
        fs.readLink(file).pipe(
          Effect.matchEffect({
            onFailure: () => Effect.succeedNone,
            onSuccess: () =>
              Effect.fail(
                invalid(file, "is a symbolic link to a missing file"),
              ),
          }),
        ),
    ),
    Effect.mapError((error) =>
      error instanceof ConfigInvalid ? error : cannotRead(file, error),
    ),
  );

/**
 * Reads `.codesaga.json` from the repository root. A missing file is an empty
 * config; a file that is not a regular file, is larger than 1 MiB, is
 * unreadable, or is invalid fails with `ConfigInvalid`.
 */
export const loadRepoConfig = (
  root: string,
): Effect.Effect<
  LoadedConfig,
  ConfigInvalid,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const file = (yield* Path.Path).join(root, CONFIG_FILE);
    const info = yield* statConfig(fs, file);
    if (Option.isNone(info)) {
      return { file, config: {} };
    }
    if (info.value.type !== "File") {
      return yield* invalid(file, "is not a regular file");
    }
    if (info.value.size > MAX_BYTES) {
      return yield* invalid(file, "is larger than 1 MiB");
    }
    const text = yield* fs
      .readFileString(file)
      .pipe(Effect.mapError((error) => cannotRead(file, error)));
    const decoded = decodeRepoConfig(text);
    if (Result.isFailure(decoded)) {
      return yield* new ConfigInvalid({ file, problems: decoded.failure });
    }
    return { file, config: decoded.success };
  });

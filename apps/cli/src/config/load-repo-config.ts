// Owns finding `.codesaga.json` in a repository root and reading it.
import { Effect, FileSystem, Path, Result } from "effect";

import { ConfigInvalid } from "../errors/config-invalid.js";
import { decodeRepoConfig } from "./repo-config.js";
import type { RepoConfig } from "./repo-config.js";

const CONFIG_FILE = ".codesaga.json";

/** A repository's config file with its location, for messages that name it. */
type LoadedConfig = {
  readonly file: string;
  readonly config: RepoConfig;
};

/**
 * Reads `.codesaga.json` from the repository root. A missing file is an empty
 * config; a file that is unreadable or invalid fails with `ConfigInvalid`.
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
    if (!(yield* fs.exists(file).pipe(Effect.orElseSucceed(() => false)))) {
      return { file, config: {} };
    }
    const text = yield* fs
      .readFileString(file)
      .pipe(
        Effect.mapError(
          (error) => new ConfigInvalid({ file, problems: [error.message] }),
        ),
      );
    const decoded = decodeRepoConfig(text);
    if (Result.isFailure(decoded)) {
      return yield* new ConfigInvalid({ file, problems: decoded.failure });
    }
    return { file, config: decoded.success };
  });

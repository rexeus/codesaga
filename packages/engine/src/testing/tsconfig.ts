import type { LoadedTsconfig } from "../typescript/tsconfig/config-file.js";
// Tests only: loaded tsconfig files for the strictness tests, without a file system.
import { directoryOf } from "../typescript/tsconfig/posix-path.js";

type ConfigParts = {
  readonly options?: Readonly<Record<string, unknown>>;
  readonly include?: ReadonlyArray<string>;
  readonly exclude?: ReadonlyArray<string>;
  readonly files?: ReadonlyArray<string>;
  /** In `extends` order: a config that was found, or the specifier of one that was not. */
  readonly extends?: ReadonlyArray<LoadedTsconfig | string>;
};

/** The config at `path` declaring `parts`. */
export const loadedConfig = (
  path: string,
  parts: ConfigParts = {},
): LoadedTsconfig => ({
  path,
  directory: directoryOf(path),
  options: parts.options ?? {},
  include: parts.include,
  exclude: parts.exclude,
  files: parts.files,
  extends: (parts.extends ?? []).map((base) =>
    typeof base === "string"
      ? { specifier: base, config: undefined }
      : { specifier: base.path, config: base },
  ),
});

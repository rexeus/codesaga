// Owns what a `tsconfig` file says, as far as the strictness report reads it, and what a loaded config is.
// A loaded config keeps the options as written; the effective values come from walking its `extends`.

import { Option, Schema } from "effect";

import { parseJsonc } from "./jsonc.js";

const RawConfig = Schema.Struct({
  extends: Schema.optionalKey(
    Schema.Union([Schema.String, Schema.Array(Schema.String)]),
  ),
  compilerOptions: Schema.optionalKey(
    Schema.Record(Schema.String, Schema.Unknown),
  ),
  include: Schema.optionalKey(Schema.Array(Schema.String)),
  exclude: Schema.optionalKey(Schema.Array(Schema.String)),
  files: Schema.optionalKey(Schema.Array(Schema.String)),
});

/** What one config file declares, before `extends` is followed. */
export type RawTsconfig = {
  readonly extends: ReadonlyArray<string>;
  readonly options: Readonly<Record<string, unknown>>;
  readonly include: ReadonlyArray<string> | undefined;
  readonly exclude: ReadonlyArray<string> | undefined;
  readonly files: ReadonlyArray<string> | undefined;
};

/** The config the text declares, or undefined when it is not JSON with comments or has the wrong shape. */
export const parseTsconfig = (text: string): RawTsconfig | undefined =>
  Option.match(Schema.decodeUnknownOption(RawConfig)(parseJsonc(text)), {
    onNone: () => undefined,
    onSome: (config) => ({
      extends:
        typeof config.extends === "string"
          ? [config.extends]
          : (config.extends ?? []),
      options: config.compilerOptions ?? {},
      include: config.include,
      exclude: config.exclude,
      files: config.files,
    }),
  });

/** One entry of `extends`: the specifier as written and the config it resolved to, undefined when it did not. */
export type ExtendsRef = {
  readonly specifier: string;
  readonly config: LoadedTsconfig | undefined;
};

/** A config file with its `extends` followed as far as the files can be found. */
export type LoadedTsconfig = Omit<RawTsconfig, "extends"> & {
  /** Repository-relative POSIX path of the file. */
  readonly path: string;
  /** Repository-relative directory of the file; "" for the root. */
  readonly directory: string;
  /** In the order TypeScript applies them: a later entry overrides an earlier one. */
  readonly extends: ReadonlyArray<ExtendsRef>;
};

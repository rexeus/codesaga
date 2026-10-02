// Owns the precedence of an analysis setting: flag, then `.codesaga.json`, then the built-in default.
import { locateRepository } from "@codesaga/engine";
import type {
  AnalyzeError,
  AnalyzeOptions,
  GithubError,
} from "@codesaga/engine";
import { Effect, Option } from "effect";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import { ConfigInvalid } from "../errors/config-invalid.js";
import { version } from "../version.js";
import { loadRepoConfig } from "./load-repo-config.js";
import type { RepoConfig } from "./repo-config.js";

/** What the command line says; empty and `None` mean "not given". */
export type SettingFlags = {
  readonly since: Option.Option<string>;
  /** `--compare` sets the window itself, so the config's `since` does not apply. */
  readonly compare: Option.Option<string>;
  readonly include: ReadonlyArray<string>;
  readonly exclude: ReadonlyArray<string>;
  readonly limit: Option.Option<number>;
  /** `--depth`: the area level to start at. */
  readonly depth: Option.Option<number>;
  /** `--blame` or `--no-blame`; `None` leaves the config in charge. */
  readonly blame: Option.Option<boolean>;
};

/** The analysis settings after flags and config are merged. */
export type Settings = Pick<
  AnalyzeOptions,
  "since" | "include" | "exclude" | "signatures" | "depth"
> & {
  /** Whether to read `git blame` for line owners; off unless a flag or the config turns it on. */
  readonly blame: boolean;
  /** Contributors and directories in `--json`; undefined when neither flag nor config sets it. */
  readonly limit: number | undefined;
  /** The config file's `gates`, for `check` to merge with its flags. */
  readonly gates: RepoConfig["gates"];
  /** Whether `since` came from the config file, so that a bad value can name it. */
  readonly sinceFromConfig: boolean;
  readonly configFile: string;
};

/**
 * Reads the config file in the root of the repository around `cwd` and merges
 * it with the flags. A flag always wins; a list flag such as `--exclude`
 * replaces the config's list instead of extending it. With `--compare` the
 * config's `since` is dropped; a `--since` flag stays, so the engine reports
 * the conflict.
 */
export const resolveSettings = (
  cwd: string,
  flags: SettingFlags,
): Effect.Effect<
  Settings,
  AnalyzeError | ConfigInvalid,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const { file, config } = yield* locateRepository(cwd).pipe(
      Effect.flatMap(loadRepoConfig),
    );
    const sinceFromConfig =
      Option.isNone(flags.since) &&
      Option.isNone(flags.compare) &&
      config.since !== undefined;
    return {
      since: sinceFromConfig
        ? config.since
        : Option.getOrUndefined(flags.since),
      include:
        flags.include.length > 0 ? flags.include : (config.include ?? []),
      exclude:
        flags.exclude.length > 0 ? flags.exclude : (config.exclude ?? []),
      signatures: config.signatures,
      limit: Option.getOrElse(flags.limit, () => config.limit),
      depth: Option.getOrElse(flags.depth, () => config.depth),
      blame: Option.getOrElse(flags.blame, () => config.blame ?? false),
      gates: config.gates,
      sinceFromConfig,
      configFile: file,
    };
  });

/**
 * The engine options every analysis takes from the settings. A caller adds
 * what only it knows: the target, `cache`, `compare`, `blame` and `patterns`.
 */
export const engineOptions = (
  settings: Settings,
): Pick<
  AnalyzeOptions,
  "since" | "include" | "exclude" | "signatures" | "depth" | "toolVersion"
> => ({
  since: settings.since,
  include: settings.include,
  exclude: settings.exclude,
  signatures: settings.signatures,
  depth: settings.depth,
  toolVersion: version,
});

/** Turns an invalid `since` that came from the config file into a config error naming the key. */
export const blameConfigSince =
  (settings: Settings) =>
  <A, E extends AnalyzeError | GithubError, R>(
    analysis: Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E | ConfigInvalid, R> =>
    Effect.mapError(analysis, (error) =>
      error._tag === "InvalidSince" && settings.sinceFromConfig
        ? new ConfigInvalid({
            file: settings.configFile,
            problems: [
              `since: invalid "${error.input}": use <n>d, <n>w, <n>m, <n>y or YYYY-MM-DD`,
            ],
          })
        : error,
    );

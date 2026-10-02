// Owns deciding which config governs a file: the one whose `include`, `files` and `exclude` select it, nearest first.
// Each config's patterns are compiled once, so assigning every file costs a match per config and file and no more.

import picomatch from "picomatch";

import type { LoadedTsconfig } from "./config-file.js";
import { depthOf, joinPosix } from "./posix-path.js";

/** The file lists TypeScript inherits as a whole: a config that lists its own replaces the extended one's. */
type ListKey = "include" | "exclude" | "files";

type Inherited = {
  readonly patterns: ReadonlyArray<string>;
  /** The directory the patterns are relative to: the config that wrote them. */
  readonly directory: string;
};

const inheritedList = (
  config: LoadedTsconfig,
  key: ListKey,
): Inherited | undefined => {
  const own = config[key];
  if (own !== undefined) {
    return { patterns: own, directory: config.directory };
  }
  for (const { config: base } of config.extends.toReversed()) {
    const found = base === undefined ? undefined : inheritedList(base, key);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
};

const CONFIG_DIR = "${configDir}";
const WILDCARDS = /[*?{}[\]]/u;
const DEFAULT_EXCLUDE = ["node_modules", "bower_components", "jspm_packages"];

/** The repository-relative path a pattern names, with `${configDir}` meaning the config that governs. */
const rootedPattern = (
  { directory }: Inherited,
  pattern: string,
  governingDirectory: string,
): string =>
  pattern.startsWith(CONFIG_DIR)
    ? joinPosix(governingDirectory, pattern.slice(CONFIG_DIR.length))
    : joinPosix(directory, pattern);

/** A pattern whose last segment has no extension or wildcard names a directory, and selects everything below it, as TypeScript reads it. */
const asGlob = (rooted: string): string => {
  const last = rooted.slice(rooted.lastIndexOf("/") + 1);
  return last.includes(".") || WILDCARDS.test(last) ? rooted : `${rooted}/**/*`;
};

const compile = (
  patterns: ReadonlyArray<string>,
): ((path: string) => boolean) =>
  patterns.length === 0 ? () => false : picomatch([...patterns], { dot: true });

/** Which files one config selects. */
export type ConfigSelection = {
  readonly path: string;
  readonly directory: string;
  /** Whether it type-checks JavaScript: `allowJs` and `checkJs` both on. */
  readonly checksJs: boolean;
  readonly selects: (path: string) => boolean;
};

const rootedAll = (
  list: Inherited | undefined,
  governingDirectory: string,
): ReadonlyArray<string> =>
  list === undefined
    ? []
    : list.patterns.map((pattern) =>
        rootedPattern(list, pattern, governingDirectory),
      );

/**
 * The selection of `config`. `files` entries are selected whatever `exclude`
 * says; `include` defaults to every file below the config when neither it nor
 * `files` is given anywhere in the chain, unless `isBase`: a config that
 * others extend and that selects nothing itself is a shared base, not a
 * project, and governs no file.
 */
export const selectionOf = (
  config: LoadedTsconfig,
  {
    checksJs,
    isBase,
  }: { readonly checksJs: boolean; readonly isBase: boolean },
): ConfigSelection => {
  const { directory } = config;
  const files = inheritedList(config, "files");
  const include = inheritedList(config, "include");
  const exclude = inheritedList(config, "exclude");
  const wholeDirectory =
    include === undefined && files === undefined && !isBase;
  const included = compile(
    wholeDirectory
      ? [asGlob(directory === "" ? "**/*" : `${directory}/**/*`)]
      : rootedAll(include, directory).map((rooted) => asGlob(rooted)),
  );
  const excluded = compile(
    (exclude === undefined
      ? DEFAULT_EXCLUDE.map((pattern) => joinPosix(directory, pattern))
      : rootedAll(exclude, directory)
    ).map((rooted) => asGlob(rooted)),
  );
  const listed = new Set(rootedAll(files, directory));
  return {
    path: config.path,
    directory,
    checksJs,
    selects: (path) => listed.has(path) || (included(path) && !excluded(path)),
  };
};

const SCRIPT_EXTENSION = /\.(?:js|jsx|mjs|cjs)$/iu;
/** Whether the path is a JavaScript file, which a config governs only when it checks JavaScript. */
export const isJavaScriptPath = (path: string): boolean =>
  SCRIPT_EXTENSION.test(path);

const isPrimary = (selection: ConfigSelection): boolean =>
  selection.path.endsWith("/tsconfig.json") ||
  selection.path === "tsconfig.json";

/**
 * The path of the config that governs `path`, or undefined when none does:
 * among the configs that select it, the deepest directory, then a plain
 * `tsconfig.json` over `tsconfig.build.json` and the like, then path order.
 * A JavaScript file is governed only by a config that checks JavaScript.
 */
export const governingConfig = (
  selections: ReadonlyArray<ConfigSelection>,
  path: string,
): string | undefined => {
  const javaScript = isJavaScriptPath(path);
  const candidates = selections.filter(
    (selection) =>
      (!javaScript || selection.checksJs) && selection.selects(path),
  );
  return candidates.toSorted(
    (left, right) =>
      depthOf(right.directory) - depthOf(left.directory) ||
      Number(isPrimary(right)) - Number(isPrimary(left)) ||
      Number(left.path > right.path) - Number(left.path < right.path),
  )[0]?.path;
};

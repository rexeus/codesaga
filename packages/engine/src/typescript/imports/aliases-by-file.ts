// Owns which `paths` and `baseUrl` apply to a file: those of the config that governs it, else of the nearest config above it, read once per config.
// A file outside every `include` (a script, a test, an excluded folder) still means `@/util` what its neighbours mean.

import type { LoadedTsconfig } from "../tsconfig/config-file.js";
import { depthOf } from "../tsconfig/posix-path.js";
import { aliasesOf } from "./ts-aliases.js";
import type { PathAliases } from "./ts-aliases.js";

const isPlain = ({ path }: LoadedTsconfig): boolean =>
  path === "tsconfig.json" || path.endsWith("/tsconfig.json");

const isAbove = ({ directory }: LoadedTsconfig, path: string): boolean =>
  directory === "" || path.startsWith(`${directory}/`);

/** The config in the nearest directory above the file, a plain `tsconfig.json` before others, then in path order. */
const nearestAbove = (
  configs: ReadonlyArray<LoadedTsconfig>,
  path: string,
): LoadedTsconfig | undefined =>
  configs
    .filter((config) => isAbove(config, path))
    .toSorted(
      (left, right) =>
        depthOf(right.directory) - depthOf(left.directory) ||
        Number(isPlain(right)) - Number(isPlain(left)) ||
        Number(left.path > right.path) - Number(left.path < right.path),
    )[0];

/**
 * A function from a file's path to the aliases of its governing config
 * (`governingConfigOf` names its path), else of the nearest config above it;
 * undefined when there is none.
 */
export const aliasesByFile = (
  configs: ReadonlyArray<LoadedTsconfig>,
  governingConfigOf: (path: string) => string | undefined,
): ((path: string) => PathAliases | undefined) => {
  const byPath = new Map(configs.map((config) => [config.path, config]));
  const cache = new Map<string, PathAliases>();
  return (path) => {
    const governing = governingConfigOf(path);
    const config =
      (governing === undefined ? undefined : byPath.get(governing)) ??
      nearestAbove(configs, path);
    if (config === undefined) {
      return undefined;
    }
    const known = cache.get(config.path);
    if (known !== undefined) {
      return known;
    }
    const aliases = aliasesOf(config);
    cache.set(config.path, aliases);
    return aliases;
  };
};

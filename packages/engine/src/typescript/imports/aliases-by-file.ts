// Owns which `paths` and `baseUrl` apply to a file: those of the config that governs it, read once per config.

import type { LoadedTsconfig } from "../tsconfig/config-file.js";
import { aliasesOf } from "./ts-aliases.js";
import type { PathAliases } from "./ts-aliases.js";

/**
 * A function from a file's path to the aliases of its governing config, undefined
 * when no config governs it. `governingConfigOf` names the governing config's path.
 */
export const aliasesByFile = (
  configs: ReadonlyArray<LoadedTsconfig>,
  governingConfigOf: (path: string) => string | undefined,
): ((path: string) => PathAliases | undefined) => {
  const byPath = new Map(configs.map((config) => [config.path, config]));
  const cache = new Map<string, PathAliases>();
  return (path) => {
    const configPath = governingConfigOf(path);
    const config =
      configPath === undefined ? undefined : byPath.get(configPath);
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

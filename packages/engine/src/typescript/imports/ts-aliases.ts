// Owns the `paths` and `baseUrl` a `tsconfig` sets, as the directories they point at in the repository.
// Each option comes from the nearest config of the `extends` chain that sets it, and is read relative to that config, as the compiler reads it.

import type { LoadedTsconfig } from "../tsconfig/config-file.js";
import { joinPosix } from "../tsconfig/posix-path.js";

type Declared = {
  readonly value: unknown;
  /** The directory of the config that sets the option. */
  readonly directory: string;
};

const declaredOption = (
  config: LoadedTsconfig,
  key: string,
): Declared | undefined => {
  const own: unknown = config.options[key];
  if (own !== undefined && own !== null) {
    return { value: own, directory: config.directory };
  }
  for (const { config: base } of config.extends.toReversed()) {
    const found = base === undefined ? undefined : declaredOption(base, key);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
};

/** One `paths` entry: the pattern and the repository-relative locations it maps to, which may hold a `*`. */
type PathPattern = {
  readonly pattern: string;
  readonly targets: ReadonlyArray<string>;
};

/** The aliases a config sets. */
export type PathAliases = {
  /** The repository-relative directory bare specifiers are tried in; undefined when `baseUrl` is not set. */
  readonly baseUrl: string | undefined;
  readonly patterns: ReadonlyArray<PathPattern>;
};

const CONFIG_DIR = "${configDir}";

const rooted = (directory: string, path: string, governing: string): string =>
  path.startsWith(CONFIG_DIR)
    ? joinPosix(governing, path.slice(CONFIG_DIR.length))
    : joinPosix(directory, path);

const stringsOf = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

/** The `paths` and `baseUrl` that govern files of `config`. */
export const aliasesOf = (config: LoadedTsconfig): PathAliases => {
  const base = declaredOption(config, "baseUrl");
  const baseUrl =
    typeof base?.value === "string"
      ? rooted(base.directory, base.value, config.directory)
      : undefined;
  const paths = declaredOption(config, "paths");
  const record: unknown = paths?.value;
  if (paths === undefined || typeof record !== "object" || record === null) {
    return { baseUrl, patterns: [] };
  }
  const root = baseUrl ?? paths.directory;
  return {
    baseUrl,
    patterns: Object.entries(record).map(([pattern, targets]) => ({
      pattern,
      targets: stringsOf(targets).map((target) =>
        rooted(root, target, config.directory),
      ),
    })),
  };
};

/** What a specifier matched in `paths`. */
export type AliasMatch = {
  /** Whether the pattern names a prefix of its own, as `@app/*` does, and not every specifier, as `*` does. */
  readonly isSpecific: boolean;
  /** The locations to try, with the matched text filled in. */
  readonly locations: ReadonlyArray<string>;
};

const prefixOf = (pattern: string): number => pattern.indexOf("*");

/** The pattern of `paths` the specifier matches: the exact one, else the one with the longest prefix. */
export const matchAlias = (
  { patterns }: PathAliases,
  specifier: string,
): AliasMatch | undefined => {
  const exact = patterns.find(({ pattern }) => pattern === specifier);
  if (exact !== undefined) {
    return { isSpecific: true, locations: exact.targets };
  }
  const matches = patterns.flatMap((entry) => {
    const star = prefixOf(entry.pattern);
    const prefix = entry.pattern.slice(0, star);
    const suffix = entry.pattern.slice(star + 1);
    return star >= 0 &&
      specifier.length >= prefix.length + suffix.length &&
      specifier.startsWith(prefix) &&
      specifier.endsWith(suffix)
      ? [
          {
            prefix,
            matched: specifier.slice(
              prefix.length,
              specifier.length - suffix.length,
            ),
            targets: entry.targets,
          },
        ]
      : [];
  });
  const best = matches.toSorted(
    (left, right) => right.prefix.length - left.prefix.length,
  )[0];
  return best === undefined
    ? undefined
    : {
        isSpecific: best.prefix !== "" || best.matched !== specifier,
        locations: best.targets.map((target) =>
          target.replaceAll("*", best.matched),
        ),
      };
};

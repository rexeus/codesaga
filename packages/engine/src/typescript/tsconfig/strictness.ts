// Owns the strictness block and each territory's `strict`: the configs read, their effective options and the files each governs.
// Pure over the loaded configs, so the report's figures and a territory's come from the same assignment.

import type {
  Strictness,
  TerritoryStrict,
  Tri,
} from "../../report/typescript-strictness.js";
import { sum } from "../../stats/measures.js";
import {
  governingConfig,
  isJavaScriptPath,
  selectionOf,
} from "./assign-configs.js";
import type { LoadedTsconfig } from "./config-file.js";
import { chainOf, postureOf, unresolvedOf } from "./effective-options.js";
import type { Posture } from "./effective-options.js";
import { FIRST_STRICT_BY_DEFAULT_MAJOR } from "./typescript-version.js";
import type { DeclaredTypeScript } from "./typescript-version.js";

/** What reading the repository's configs and manifests found. */
export type TsconfigProject = {
  readonly configs: ReadonlyArray<LoadedTsconfig>;
  readonly typescript: DeclaredTypeScript;
};

/** The block, and the `strict` of any set of files. */
export type StrictnessAnalysis = {
  readonly section: Strictness;
  /** `strict` over the governed files among `paths`; undefined when none is governed. */
  readonly strictOf: (
    paths: ReadonlyArray<string>,
  ) => TerritoryStrict | undefined;
};

/** Whether the file is a plain `tsconfig.json`, which is a project of its directory even when others extend it. */
const isPlainName = (path: string): boolean =>
  path === "tsconfig.json" || path.endsWith("/tsconfig.json");

/** On when every declared major defaults `strict` to true, off when none does, `unknown` when they differ or none is known. */
const strictByDefaultOf = ({ majors }: DeclaredTypeScript): Tri => {
  const strict = majors.map((major) => major >= FIRST_STRICT_BY_DEFAULT_MAJOR);
  if (strict.length === 0 || strict.includes(true) === strict.includes(false)) {
    return "unknown";
  }
  return strict.includes(true);
};

const summarize = (values: ReadonlySet<Tri>): TerritoryStrict | undefined => {
  if (values.has(true) && values.has(false)) {
    return "mixed";
  }
  if (values.has("unknown")) {
    return "unknown";
  }
  if (values.has(true)) {
    return true;
  }
  return values.has(false) ? false : undefined;
};

/** The config each path is governed by, undefined for a path no config governs. */
const assignmentOf = (
  configs: ReadonlyArray<LoadedTsconfig>,
  postures: ReadonlyMap<string, Posture>,
  paths: ReadonlyArray<string>,
): ReadonlyMap<string, string | undefined> => {
  const extended = new Set(configs.flatMap((config) => chainOf(config)));
  const selections = configs.map((config) => {
    const posture = postures.get(config.path);
    return selectionOf(config, {
      checksJs: posture?.allowJs === true && posture.checkJs === true,
      isBase: extended.has(config.path) && !isPlainName(config.path),
    });
  });
  return new Map(
    paths.map((path) => [path, governingConfig(selections, path)]),
  );
};

const byFilesThenPath = (
  left: { readonly files: number; readonly path: string },
  right: { readonly files: number; readonly path: string },
): number =>
  right.files - left.files ||
  Number(left.path > right.path) - Number(left.path < right.path);

/**
 * Reads the posture of every config and assigns `paths`, the universe's
 * TypeScript and JavaScript files, to the config that governs each.
 */
export const strictnessOf = (
  { configs, typescript }: TsconfigProject,
  paths: ReadonlyArray<string>,
): StrictnessAnalysis => {
  const strictByDefault = strictByDefaultOf(typescript);
  const postures = new Map(
    configs.map((config) => [config.path, postureOf(config, strictByDefault)]),
  );
  const governor = assignmentOf(configs, postures, paths);
  const governedBy = new Map<string, number>();
  for (const configPath of governor.values()) {
    if (configPath !== undefined) {
      governedBy.set(configPath, (governedBy.get(configPath) ?? 0) + 1);
    }
  }
  const governed = sum(governedBy.values());
  const outside = [...governor].filter(([, config]) => config === undefined);
  const jsOutside = outside.filter(([path]) => isJavaScriptPath(path)).length;
  return {
    section: {
      typescript: { declared: typescript.declared, strictByDefault },
      configs: configs
        .map((config) => ({
          path: config.path,
          extends: chainOf(config),
          unresolved: unresolvedOf(config),
          files: governedBy.get(config.path) ?? 0,
          ...postureOf(config, strictByDefault),
        }))
        .toSorted(byFilesThenPath),
      totalConfigs: configs.length,
      governedFiles: governed,
      ungovernedFiles: outside.length - jsOutside,
      jsFilesOutsideConfigs: jsOutside,
    },
    strictOf: (territoryPaths) =>
      summarize(
        new Set(
          territoryPaths.flatMap((path) => {
            const configPath = governor.get(path);
            const strict =
              configPath === undefined
                ? undefined
                : postures.get(configPath)?.strict;
            return strict === undefined ? [] : [strict];
          }),
        ),
      ),
  };
};

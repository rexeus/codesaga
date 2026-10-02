// Owns which TypeScript version a repository declares, because TypeScript 6 turned `strict` on by default.
// The root manifest names it, directly or through a pnpm catalog; nothing else is read, and a range is never resolved to an installed version.

import { parseJsonc } from "./jsonc.js";

/** The TypeScript the repository declares. */
export type DeclaredTypeScript = {
  /** The distinct ranges as written, a catalog entry resolved, the root manifest's first, joined by a comma; null when none is readable. */
  readonly declared: string | null;
  /** The distinct major versions the ranges name, ascending; empty when none names one, as `latest` does. */
  readonly majors: ReadonlyArray<number>;
};

/** The first TypeScript major that defaults `strict` to true. */
export const FIRST_STRICT_BY_DEFAULT_MAJOR = 6;

const NOT_DECLARED: DeclaredTypeScript = { declared: null, majors: [] };

const stringField = (value: unknown, key: string): string | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const field: unknown = Reflect.get(value, key);
  return typeof field === "string" ? field : undefined;
};

/** The `typescript` range in `devDependencies`, `dependencies` or `peerDependencies` of manifest JSON, undefined when none. */
export const typescriptRangeOf = (manifest: unknown): string | undefined => {
  for (const section of [
    "devDependencies",
    "dependencies",
    "peerDependencies",
  ]) {
    const entries: unknown =
      typeof manifest === "object" && manifest !== null
        ? Reflect.get(manifest, section)
        : undefined;
    const version = stringField(entries, "typescript");
    if (version !== undefined) {
      return version;
    }
  }
  return undefined;
};

const CATALOG_ENTRY = /^\s+["']?typescript["']?\s*:\s*["']?([^\s"'#]+)/u;
const TOP_LEVEL_KEY = /^([\w-]+)\s*:/u;
const CATALOG_NAME_KEY = /^ {2}["']?([^\s"':]+)["']?\s*:\s*$/u;

/**
 * The `typescript` entry of a pnpm catalog in `pnpm-workspace.yaml`: the
 * default catalog for `name` undefined, else the named one under `catalogs`.
 * A line scan, since the file's few shapes do not need a YAML parser.
 */
const catalogEntry = (
  workspaceYaml: string,
  name: string | undefined,
): string | undefined => {
  let section = "";
  let named = "";
  for (const line of workspaceYaml.split("\n")) {
    const top = TOP_LEVEL_KEY.exec(line)?.[1];
    if (top !== undefined) {
      section = top;
      named = "";
    } else if (section === "catalogs") {
      named = CATALOG_NAME_KEY.exec(line)?.[1] ?? named;
    }
    const inWanted =
      name === undefined
        ? section === "catalog"
        : section === "catalogs" && named === name;
    const entry = inWanted ? CATALOG_ENTRY.exec(line)?.[1] : undefined;
    if (entry !== undefined) {
      return entry;
    }
  }
  return undefined;
};

const resolveCatalog = (
  range: string,
  workspaceYaml: string | undefined,
): string | undefined => {
  if (!range.startsWith("catalog:")) {
    return range;
  }
  const name = range.slice("catalog:".length);
  return workspaceYaml === undefined
    ? undefined
    : catalogEntry(
        workspaceYaml,
        name === "" || name === "default" ? undefined : name,
      );
};

const VERSION_TOKEN = /\d+(?:\.[\dx*]+)*/gu;

/** The major versions a range names: every version in it, so `^5.9 || ^6.0` names 5 and 6. */
const majorsOf = (range: string): ReadonlyArray<number> =>
  (range.match(VERSION_TOKEN) ?? []).map((token) =>
    Number(token.split(".")[0]),
  );

/**
 * The TypeScript the root `package.json` text and the workspace manifests
 * declare, in `devDependencies`, `dependencies` or `peerDependencies`,
 * resolving a `catalog:` range through `pnpm-workspace.yaml`. A range that
 * cannot be resolved, and a repository that declares none, is `declared: null`.
 * `manifestRanges` are the ranges as the manifests wrote them, `catalog:`
 * included.
 */
export const declaredTypeScript = (
  rootPackageJson: string | undefined,
  manifestRanges: ReadonlyArray<string>,
  workspaceYaml: string | undefined,
): DeclaredTypeScript => {
  const rootRange = typescriptRangeOf(
    rootPackageJson === undefined ? undefined : parseJsonc(rootPackageJson),
  );
  const resolved = [
    ...(rootRange === undefined ? [] : [rootRange]),
    ...manifestRanges,
  ].flatMap((range) => resolveCatalog(range, workspaceYaml) ?? []);
  const distinct = [...new Set(resolved)];
  if (distinct.length === 0) {
    return NOT_DECLARED;
  }
  const majors = [...new Set(distinct.flatMap((range) => majorsOf(range)))];
  return {
    declared: distinct.join(", "),
    majors: majors.toSorted((left, right) => left - right),
  };
};

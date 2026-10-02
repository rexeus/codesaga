// Owns which TypeScript version a repository declares, because TypeScript 6 turned `strict` on by default.
// The root manifest names it, directly or through a pnpm catalog; nothing else is read, and a range is never resolved to an installed version.

import { parseJsonc } from "./jsonc.js";

/** The TypeScript the repository declares. */
export type DeclaredTypeScript = {
  /** The range as written, a catalog entry resolved; null when none is readable. */
  readonly declared: string | null;
  /** The first number of the range; null when it has none, as in `latest`. */
  readonly major: number | null;
};

/** The first TypeScript major that defaults `strict` to true. */
export const FIRST_STRICT_BY_DEFAULT_MAJOR = 6;

const NOT_DECLARED: DeclaredTypeScript = { declared: null, major: null };

const stringField = (value: unknown, key: string): string | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const field: unknown = Reflect.get(value, key);
  return typeof field === "string" ? field : undefined;
};

const dependencyIn = (manifest: unknown): string | undefined => {
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

/**
 * The TypeScript the root `package.json` text declares, in
 * `devDependencies`, `dependencies` or `peerDependencies`, resolving a
 * `catalog:` range through `pnpm-workspace.yaml`. Not declared, or a catalog
 * that cannot be read, is `declared: null`.
 */
export const declaredTypeScript = (
  packageJson: string | undefined,
  workspaceYaml: string | undefined,
): DeclaredTypeScript => {
  const range = dependencyIn(
    packageJson === undefined ? undefined : parseJsonc(packageJson),
  );
  const declared =
    range === undefined ? undefined : resolveCatalog(range, workspaceYaml);
  if (declared === undefined) {
    return NOT_DECLARED;
  }
  const major = /\d+/u.exec(declared)?.[0];
  return { declared, major: major === undefined ? null : Number(major) };
};

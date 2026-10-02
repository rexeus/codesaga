// Owns deciding what an import specifier names: a source file of the repository, a package outside it, an asset, or nothing that can be found.
// Hand-rolled over the files the analysis knows, so it never touches the file system. A specifier is unresolved only where it points into the repository (relative, a `paths` alias, a workspace package) and no file is there; a bare name no rule claims is external and is never guessed at.

import type { PackageManifest } from "../ecosystem/read-manifests.js";
import { splitPackageSpecifier } from "../tsconfig/package-entry.js";
import { directoryOf, joinPosix } from "../tsconfig/posix-path.js";
import { sourceFileOf } from "./source-file.js";
import { matchAlias } from "./ts-aliases.js";
import type { PathAliases } from "./ts-aliases.js";
import { workspaceResolver } from "./workspace-packages.js";

/** What a specifier names. */
export type Resolution =
  /** A source file of the repository. */
  | { readonly kind: "file"; readonly path: string }
  /** A package or built-in outside the repository, which is counted and not resolved. */
  | { readonly kind: "external" }
  /** A file that is not code (styles, data, images) and so no node of the graph. */
  | { readonly kind: "asset" }
  /** A specifier that points into the repository where no file can be found. */
  | { readonly kind: "unresolved" };

/** What resolving needs to know about the repository. */
export type ResolverInputs = {
  /** The repository-relative paths of the TypeScript and JavaScript files, declaration files included. */
  readonly files: ReadonlySet<string>;
  readonly manifests: ReadonlyArray<PackageManifest>;
  /** The `paths` and `baseUrl` of the config that governs the file; undefined when none does. */
  readonly aliasesFor: (path: string) => PathAliases | undefined;
};

const ASSET_EXTENSIONS: ReadonlySet<string> = new Set([
  "css",
  "scss",
  "sass",
  "less",
  "styl",
  "json",
  "json5",
  "yaml",
  "yml",
  "toml",
  "svg",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "ico",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "mp3",
  "mp4",
  "webm",
  "wasm",
  "txt",
  "md",
  "mdx",
  "html",
  "graphql",
  "gql",
  "sql",
  "node",
]);

const PROTOCOL = /^[a-z][a-z\d+.-]*:/iu;
const QUERY = /[?#].*$/u;

const isRelative = (specifier: string): boolean =>
  specifier === "." ||
  specifier === ".." ||
  specifier.startsWith("./") ||
  specifier.startsWith("../");

const isAsset = (specifier: string): boolean =>
  ASSET_EXTENSIONS.has(specifier.slice(specifier.lastIndexOf(".") + 1));

const FILE = (path: string): Resolution => ({ kind: "file", path });
const EXTERNAL: Resolution = { kind: "external" };
const UNRESOLVED: Resolution = { kind: "unresolved" };

/**
 * A function that resolves the specifier `specifier` of the file at `from`.
 * A relative specifier is resolved against the file's directory; a bare one
 * through the governing config's `paths`, then its `baseUrl`, then the
 * workspace packages. A `node:`, URL or other scheme specifier is external, a
 * `#` import of a manifest and an absolute path are unresolved, and a query or
 * fragment (`?raw`) is ignored.
 */
export const createResolver = ({
  files,
  manifests,
  aliasesFor,
}: ResolverInputs): ((from: string, specifier: string) => Resolution) => {
  const has = (path: string): boolean => files.has(path);
  const workspace = workspaceResolver(manifests, has);
  const firstFound = (locations: ReadonlyArray<string>): string | undefined =>
    locations
      .map((location) => sourceFileOf(location, has))
      .find((found) => found !== undefined);

  const resolveBare = (from: string, specifier: string): Resolution => {
    const aliases = aliasesFor(from);
    const alias =
      aliases === undefined ? undefined : matchAlias(aliases, specifier);
    const aliased =
      alias === undefined ? undefined : firstFound(alias.locations);
    if (aliased !== undefined) {
      return FILE(aliased);
    }
    const inBase =
      aliases?.baseUrl === undefined
        ? undefined
        : sourceFileOf(joinPosix(aliases.baseUrl, specifier), has);
    if (inBase !== undefined) {
      return FILE(inBase);
    }
    const { name, subpath } = splitPackageSpecifier(specifier);
    if (workspace.isWorkspace(name)) {
      const entry = workspace.resolve(name, subpath);
      return entry === undefined ? UNRESOLVED : FILE(entry);
    }
    return alias?.isSpecific === true ? UNRESOLVED : EXTERNAL;
  };

  return (from, raw) => {
    const specifier = raw.startsWith("#") ? raw : raw.replace(QUERY, "");
    if (PROTOCOL.test(specifier)) {
      return EXTERNAL;
    }
    if (isRelative(specifier)) {
      const found = sourceFileOf(joinPosix(directoryOf(from), specifier), has);
      if (found !== undefined) {
        return FILE(found);
      }
      return isAsset(specifier) ? { kind: "asset" } : UNRESOLVED;
    }
    if (specifier.startsWith("/") || specifier.startsWith("#")) {
      return UNRESOLVED;
    }
    return resolveBare(from, specifier);
  };
};

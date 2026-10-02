// Owns recognizing package roots: the directories whose manifest says "a package starts here".
// The manifests of the ecosystems the language allow-list covers; the names are the only signal.

const MANIFEST_NAMES = new Set([
  "package.json",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "setup.py",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "composer.json",
  "Gemfile",
  "mix.exs",
  "deno.json",
  "deno.jsonc",
]);
const MANIFEST_SUFFIX = ".csproj";

const isManifest = (name: string): boolean =>
  MANIFEST_NAMES.has(name) || name.endsWith(MANIFEST_SUFFIX);

/**
 * The directories that hold a package manifest (`package.json`, `Cargo.toml`,
 * `go.mod`, `pyproject.toml`, `setup.py`, `pom.xml`, `build.gradle(.kts)`,
 * `*.csproj`, `composer.json`, `Gemfile`, `mix.exs`, `deno.json(c)`), sorted
 * and without duplicates; "." is the repository root. `trackedPaths` are
 * repository-relative and include files that are not code, manifests above all.
 */
export const packageRootsOf = (
  trackedPaths: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const roots = trackedPaths.flatMap((path) => {
    const slash = path.lastIndexOf("/");
    return isManifest(path.slice(slash + 1))
      ? [slash < 0 ? "." : path.slice(0, slash)]
      : [];
  });
  return [...new Set(roots)].toSorted();
};

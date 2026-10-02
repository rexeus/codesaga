// Owns which manifests and configs count as the project's own: the `package.json` and `tsconfig*.json` files the deep dives read.
// The universe's rules apply to them as to code: vendored and generated files do not count, and neither do the samples a repository ships for others to copy.

import { Effect } from "effect";

import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import { inExcludedDirectory } from "./inventory.js";
import { withoutGeneratedFiles } from "./tracked-files.js";

/** Directories that hold samples, not the project: their manifests and configs say what an example uses. */
const SAMPLE_DIRECTORIES = new Set([
  "example",
  "examples",
  "template",
  "templates",
  "fixtures",
  "__fixtures__",
]);

const TSCONFIG_NAME = /^tsconfig(?:\.[^/]+)?\.json$/u;

const baseName = (path: string): string =>
  path.slice(path.lastIndexOf("/") + 1);

const inSampleDirectory = (path: string): boolean =>
  path
    .split("/")
    .slice(0, -1)
    .some((directory) => SAMPLE_DIRECTORIES.has(directory));

/** The project's own manifests and configs, repository-relative, in the order of the tracked files. */
export type ProjectFiles = {
  readonly manifests: ReadonlyArray<string>;
  readonly tsconfigs: ReadonlyArray<string>;
};

/**
 * The `package.json` and `tsconfig*.json` files among `tracked` that belong to
 * the project: not in a vendored, generated, build-output or `node_modules`
 * directory (the universe's own list), not in a sample directory (`example`,
 * `examples`, `template`, `templates`, `fixtures`, `__fixtures__`), and not
 * marked `linguist-vendored` or `linguist-generated`. Git must run in the
 * work tree root.
 */
export const projectFilesOf = (
  tracked: ReadonlyArray<string>,
): Effect.Effect<ProjectFiles, GitError, Git> =>
  Effect.gen(function* () {
    const own = yield* withoutGeneratedFiles(
      tracked.filter(
        (path) =>
          (baseName(path) === "package.json" ||
            TSCONFIG_NAME.test(baseName(path))) &&
          !inExcludedDirectory(path) &&
          !inSampleDirectory(path),
      ),
    );
    return {
      manifests: own.filter((path) => baseName(path) === "package.json"),
      tsconfigs: own.filter((path) => baseName(path) !== "package.json"),
    };
  });

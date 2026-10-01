// Builds throwaway git repositories for CLI journeys, isolated from the host's git config.
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { Effect } from "effect";

type Person = { readonly name: string; readonly email: string };

const isolatedEnv = (date: string, author?: Person): NodeJS.ProcessEnv => ({
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_DATE: date,
  GIT_COMMITTER_DATE: date,
  ...(author === undefined
    ? {}
    : { GIT_AUTHOR_NAME: author.name, GIT_AUTHOR_EMAIL: author.email }),
});

type CommitOptions = {
  /** Defaults to the repository's configured user. */
  readonly author?: Person;
  /** Defaults to "change <daysAgo>". */
  readonly message?: string;
};

export type GitRepository = {
  readonly root: string;
  /** Writes `files` and commits them at `daysAgo` days before now. */
  readonly commit: (
    daysAgo: number,
    files: Record<string, string>,
    options?: CommitOptions,
  ) => void;
};

/** A temporary directory, removed when the scope closes. */
export const makeTempDirectory = Effect.acquireRelease(
  Effect.sync(() => mkdtempSync(join(tmpdir(), "codesaga-cli-"))),
  (directory) =>
    Effect.sync(() => {
      rmSync(directory, { force: true, recursive: true });
    }),
);

/** An initialized repository in a temporary directory, removed when the scope closes. */
export const makeGitRepository = Effect.map(
  makeTempDirectory,
  (root): GitRepository => {
    const git = (args: ReadonlyArray<string>, date: string, author?: Person) =>
      execFileSync("git", ["-C", root, ...args], {
        env: isolatedEnv(date, author),
        stdio: "ignore",
      });
    const now = new Date().toISOString();
    git(["init", "--quiet", "--initial-branch=main"], now);
    git(["config", "user.name", "Journey"], now);
    git(["config", "user.email", "journey@example.invalid"], now);
    return {
      root,
      commit: (daysAgo, files, options = {}) => {
        const date = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
        for (const [path, content] of Object.entries(files)) {
          mkdirSync(dirname(join(root, path)), { recursive: true });
          writeFileSync(join(root, path), content);
        }
        git(["add", "--all"], date);
        git(
          ["commit", "--quiet", "-m", options.message ?? `change ${daysAgo}`],
          date,
          options.author,
        );
      },
    };
  },
);

/** A clone of `source` cut to its newest `depth` commits, in a temporary directory removed when the scope closes. */
export const makeShallowClone = (source: GitRepository, depth: number) =>
  Effect.map(makeTempDirectory, (directory) => {
    const root = join(directory, "clone");
    execFileSync(
      "git",
      [
        "clone",
        "--quiet",
        "--depth",
        String(depth),
        `file://${source.root}`,
        root,
      ],
      { env: isolatedEnv(new Date().toISOString()), stdio: "ignore" },
    );
    return root;
  });

/**
 * Makes `git blame` fail for `file` while `git log` still reads it: a
 * textconv filter that exits non-zero, routed to the file by the attributes.
 */
export const breakBlameOf = (repo: GitRepository, file: string): void => {
  appendFileSync(
    join(repo.root, ".git", "config"),
    '[diff "broken"]\n\ttextconv = false\n',
  );
  mkdirSync(join(repo.root, ".git", "info"), { recursive: true });
  appendFileSync(
    join(repo.root, ".git", "info", "attributes"),
    `${file} diff=broken\n`,
  );
};

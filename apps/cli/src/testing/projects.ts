// Repository shapes and host conditions shared by the CLI journeys.
import { chmodSync, existsSync, symlinkSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";

import { Effect } from "effect";

import { makeGitRepository, makeTempDirectory } from "./git-repository.js";

const ada = { name: "Ada Lovelace", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };
const dependabot = {
  name: "dependabot[bot]",
  email: "49699333+dependabot[bot]@users.noreply.github.com",
};

/**
 * Five commits by two people and Dependabot, dated relative to now:
 * 400 days ago Ada adds a file, 60 days ago Ada edits it, 20 days ago Grace
 * adds another with Claude as co-author, 10 days ago Dependabot changes the
 * lockfile, 5 days ago Ada edits again. The branch is `main`.
 */
export const makeTeamProject = Effect.map(makeGitRepository, (repo) => {
  repo.commit(
    400,
    { "src/a.ts": "a1\n", "pnpm-lock.yaml": "l1\n" },
    { author: ada },
  );
  repo.commit(60, { "src/a.ts": "a1\na2\n" }, { author: ada });
  repo.commit(
    20,
    { "src/b.ts": "b1\nb2\nb3\n" },
    {
      author: grace,
      message:
        "Add b\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>",
    },
  );
  repo.commit(10, { "pnpm-lock.yaml": "l1\nl2\n" }, { author: dependabot });
  repo.commit(5, { "src/a.ts": "a1\na2\na3\n" }, { author: ada });
  return repo;
});

const threeFiles = (directory: string) =>
  Object.fromEntries(
    [1, 2, 3].map((index) => [`${directory}/f${index}.ts`, "x\n"]),
  );

/**
 * Ada, 30 days ago, adds three files in each of `a/x`, `b` and `c`, and Grace
 * three in `a/y`: the knowledge territories are the top-level directories `a`, `b`
 * and `c`, and `a` splits at detail 2 because `a/x` and `a/y` have different
 * experts. Two contributors allow 4 territories, which detail 2 (4) meets, but a
 * fourth directory `d` makes it 5, so detail 1 is the recommended one.
 */
export const makeTerritoriesProject = Effect.map(makeGitRepository, (repo) => {
  repo.commit(
    30,
    {
      ...threeFiles("a/x"),
      ...threeFiles("b"),
      ...threeFiles("c"),
      ...threeFiles("d"),
    },
    { author: ada },
  );
  repo.commit(29, threeFiles("a/y"), { author: grace });
  return repo;
});

/** The team project with an `origin` on github.com, as `--github` needs. */
export const makeGithubProject = Effect.map(makeTeamProject, (repo) => {
  repo.addOrigin("git@github.com:acme/web.git");
  return repo;
});

/** Sets PATH for the scope and restores it afterwards; spawned programs resolve against it. */
export const withPath = (value: string) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const saved = process.env["PATH"];
      process.env["PATH"] = value;
      return saved;
    }),
    (saved) =>
      Effect.sync(() => {
        process.env["PATH"] = saved;
      }),
  );

/** Empties PATH for the scope, so spawning git fails as on a machine without it. */
export const withoutGitOnPath = withPath("");

/** Where `git` is on the real PATH. */
const findGit = (): string => {
  const directory = (process.env["PATH"] ?? "")
    .split(delimiter)
    .find((entry) => existsSync(join(entry, "git")));
  if (directory === undefined) {
    throw new Error("git is not on PATH");
  }
  return join(directory, "git");
};

/** PATH with `git` and no `gh`, as on a machine that never installed the GitHub CLI. */
export const withoutGhOnPath = Effect.flatMap(makeTempDirectory, (bin) => {
  symlinkSync(findGit(), join(bin, "git"));
  return withPath(bin);
});

/**
 * Puts a fake `gh` first on PATH. Logged in, `gh auth token --hostname <host>`
 * prints `gh-token-for-<host>`; logged out, it fails like the real one.
 */
export const withFakeGh = (state: "logged-in" | "logged-out") =>
  Effect.flatMap(makeTempDirectory, (bin) => {
    const script = join(bin, "gh");
    writeFileSync(
      script,
      state === "logged-in"
        ? '#!/bin/sh\n[ "$1 $2 $3" = "auth token --hostname" ] && echo "gh-token-for-$4"\n'
        : "#!/bin/sh\nexit 1\n",
    );
    chmodSync(script, 0o755);
    return withPath(`${bin}${delimiter}${process.env["PATH"] ?? ""}`);
  });

import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { makeTempDirectory } from "../testing/git-repository.js";
import { journey } from "../testing/journey-harness.js";
import { makeTeamProject, withoutGitOnPath } from "../testing/projects.js";

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codesaga exit codes", () => {
  it.live("exits 3 outside a git repository", () =>
    Effect.gen(function* () {
      const directory = yield* makeTempDirectory;

      const result = yield* journey({
        args: ["analyze", "--json"],
        cwd: directory,
      });

      expect(result.stdout).toBe("");
      expect(result.exitCode).toBe(3);
    }).pipe(Effect.scoped),
  );

  it.live("exits 2 on an invalid --since", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["analyze", "--since", "soon"],
        cwd: repo.root,
      });

      expect(result.stdout).toBe("");
      expect(result.exitCode).toBe(2);
    }).pipe(Effect.scoped),
  );

  it.live("exits 2 when the path to analyze does not exist", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["analyze", "src/missing.ts"],
        cwd: repo.root,
      });

      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        `codesaga: no such file or directory: ${repo.root}/src/missing.ts`,
      );
      expect(result.exitCode).toBe(2);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga exit codes for --compare", () => {
  it.live.each([
    {
      args: ["--compare", "soon"],
      message:
        'codesaga: invalid --compare "soon": use <n>d, <n>w, <n>m or <n>y',
    },
    {
      args: ["--compare", "3m", "--since", "30d"],
      message:
        "codesaga: --compare cannot be combined with --since: it sets the window itself",
    },
  ])("exits 2 on $args", ({ args, message }) =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["analyze", ...args],
        cwd: repo.root,
      });

      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(message);
      expect(result.exitCode).toBe(2);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga exit codes on a broken host", () => {
  it.live("exits 3 without git on PATH", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      yield* withoutGitOnPath;

      const result = yield* journey({ args: ["analyze"], cwd: repo.root });

      expect(result.stderr).toBe(
        "codesaga: git was not found on PATH; codesaga needs git",
      );
      expect(result.exitCode).toBe(3);
    }).pipe(Effect.scoped),
  );

  it.live("escapes control characters in a reported path", () =>
    Effect.gen(function* () {
      const directory = yield* makeTempDirectory;
      const hostile = join(directory, "\u001B[31mred");
      mkdirSync(hostile);

      const result = yield* journey({ args: ["analyze"], cwd: hostile });

      expect(result.stderr).toBe(
        `codesaga: not a git repository: ${directory}/\\u001b[31mred`,
      );
    }).pipe(Effect.scoped),
  );
});

import { InspectResult } from "@codesaga/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { journey } from "../testing/journey-harness.js";
import { makeTeamProject } from "../testing/projects.js";

const decode = (stdout: string) =>
  Schema.decodeUnknownEffect(InspectResult)(JSON.parse(stdout));

const RELATIVE_TO_ROOT = "(patterns are relative to the repository root)";

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codesaga inspect --json", () => {
  it.live(
    "aggregates a glob into one entry that decodes with the InspectResult schema",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;

        const result = yield* journey({
          args: ["inspect", "src/*.ts", "--json"],
          cwd: repo.root,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe("");
        const inspected = yield* decode(result.stdout);
        expect(inspected.matches).toHaveLength(1);
        expect(inspected.matches[0]).toMatchObject({
          pattern: "src/*.ts",
          files: 2,
          commits: 4,
          automation: { human: 3, agentAssisted: 1, agent: 0, bot: 0 },
        });
        expect(
          inspected.matches[0]?.experts.map(({ name }) => name),
        ).toStrictEqual(["Ada Lovelace", "Grace"]);
        expect(inspected.unmatched).toStrictEqual([]);
      }).pipe(Effect.scoped),
  );

  it.live("returns one entry per argument, in the order given", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["inspect", "src/b.ts", "src/a.ts", "--json"],
        cwd: repo.root,
      });

      const inspected = yield* decode(result.stdout);
      expect(
        inspected.matches.map(({ pattern, files }) => [pattern, files]),
      ).toStrictEqual([
        ["src/b.ts", 1],
        ["src/a.ts", 1],
      ]);
    }).pipe(Effect.scoped),
  );

  it.live("inspects from a subdirectory with repository-relative paths", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["inspect", "src/a.ts", "--json"],
        cwd: `${repo.root}/src`,
      });

      const inspected = yield* decode(result.stdout);
      expect(inspected.matches.map(({ pattern }) => pattern)).toStrictEqual([
        "src/a.ts",
      ]);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga inspect the whole repository", () => {
  it.live.each(["", "."])("answers %j for every file", (pattern) =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["inspect", pattern, "--json"],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      const inspected = yield* decode(result.stdout);
      expect(inspected.unmatched).toStrictEqual([]);
      expect(
        inspected.matches.map((entry) => [entry.pattern, entry.files]),
      ).toStrictEqual([[pattern, 2]]);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga inspect output", () => {
  it.live("prints the terminal view without ANSI codes when piped", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["inspect", "src/a.ts"],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("src/a.ts\n1 file · truck factor 1");
      expect(result.stdout).toContain("Ada Lovelace");
      expect(result.stdout).not.toContain("\u001B");
    }).pipe(Effect.scoped),
  );

  it.live(
    "reports an unmatched argument on stderr and still answers the others",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;

        const result = yield* journey({
          args: ["inspect", "src/a.ts", "nope/**", "--json"],
          cwd: repo.root,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe(
          `codesaga: no file matches "nope/**" ${RELATIVE_TO_ROOT}`,
        );
        const inspected = yield* decode(result.stdout);
        expect(inspected.unmatched).toStrictEqual(["nope/**"]);
        expect(inspected.matches).toHaveLength(1);
      }).pipe(Effect.scoped),
  );

  it.live("exits 4 with nothing on stdout when no argument matches", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["inspect", "nope/**", "gone.ts", "--json"],
        cwd: repo.root,
      });

      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        `codesaga: no file matches "nope/**", "gone.ts" ${RELATIVE_TO_ROOT}`,
      );
      expect(result.exitCode).toBe(4);
    }).pipe(Effect.scoped),
  );
});

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { CheckResult } from "../check/check-result.js";
import { makeShallowClone } from "../testing/git-repository.js";
import type { GitRepository } from "../testing/git-repository.js";
import { journey } from "../testing/journey-harness.js";
import { makeTeamProject } from "../testing/projects.js";

const writeGates = (repo: GitRepository, gates: unknown) => {
  writeFileSync(join(repo.root, ".codesaga.json"), JSON.stringify({ gates }));
};

const checkJson = (repo: GitRepository, ...flags: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const result = yield* journey({
      args: ["check", "--json", ...flags],
      cwd: repo.root,
    });
    return {
      ...result,
      document: yield* Schema.decodeUnknownEffect(CheckResult)(
        JSON.parse(result.stdout),
      ),
    };
  });

// The team project has a truck factor of 2 (Ada and Grace each carry one of two files),
// two contributors active in 90 days, and 1 of its 5 commits co-authored by an agent.
// Real clock: the commits are dated relative to now.
describe("codesaga check when gates pass", () => {
  it.live("exits 0 and lists every gate when all pass", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: [
          "check",
          "--min-truck-factor",
          "2",
          "--min-active-contributors",
          "2",
          "--max-agent-share",
          "0.2",
        ],
        cwd: repo.root,
      });

      expect(result.stdout).toBe(
        [
          "✓ truck factor: 2, at least the minimum of 2",
          "✓ agent and agent-assisted share of commits: 20%, within the maximum of 20%",
          "✓ contributors active in 90 days: 2, at least the minimum of 2",
          "",
          "All 3 gates passed",
        ].join("\n"),
      );
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga check when a gate fails", () => {
  it.live("exits 5 with the reason on stdout when a gate fails", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["check", "--min-truck-factor", "3", "--max-orphaned", "0"],
        cwd: repo.root,
      });

      expect(result.stdout).toBe(
        [
          "✗ truck factor: 2, below the minimum of 3",
          "✓ orphaned directories: 0, within the maximum of 0",
          "",
          "1 of 2 gates failed",
        ].join("\n"),
      );
      expect(result.stderr).toBe("codesaga: 1 of 2 gates failed");
      expect(result.exitCode).toBe(5);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga check as JSON", () => {
  it.live(
    "prints one JSON document on stdout and exits 5 when a gate fails",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;

        const { document, exitCode } = yield* checkJson(
          repo,
          "--min-truck-factor",
          "3",
          "--max-islands",
          "0",
        );

        expect(document).toStrictEqual({
          schemaVersion: 1,
          passed: false,
          gates: [
            {
              name: "minTruckFactor",
              threshold: 3,
              actual: 2,
              passed: false,
              reason: "truck factor: 2, below the minimum of 3",
            },
            {
              name: "maxIslandDirectories",
              threshold: 0,
              actual: 0,
              passed: true,
              reason:
                "knowledge island directories: 0, within the maximum of 0",
            },
          ],
        });
        expect(exitCode).toBe(5);
      }).pipe(Effect.scoped),
  );
});

describe("codesaga check gate sources", () => {
  it.live(
    "applies the gates of .codesaga.json, and a flag overrides one of them",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;
        writeGates(repo, { minTruckFactor: 3, minActiveContributors: 2 });

        const fromConfig = yield* checkJson(repo);
        const overridden = yield* checkJson(repo, "--min-truck-factor", "2");

        expect(fromConfig.exitCode).toBe(5);
        expect(
          fromConfig.document.gates.map((gate) => gate.passed),
        ).toStrictEqual([false, true]);
        expect(overridden.exitCode).toBe(0);
        expect(
          overridden.document.gates.map(({ name, threshold }) => [
            name,
            threshold,
          ]),
        ).toStrictEqual([
          ["minTruckFactor", 2],
          ["minActiveContributors", 2],
        ]);
      }).pipe(Effect.scoped),
  );
});

describe("codesaga check without usable gates", () => {
  it.live("exits 2 without running when no gate is configured", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["check", "--json"],
        cwd: repo.root,
      });

      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        'codesaga: no gates configured: pass a gate flag such as --min-truck-factor, or set "gates" in .codesaga.json',
      );
      expect(result.exitCode).toBe(2);
    }).pipe(Effect.scoped),
  );

  it.live("exits 2 for an agent share outside 0 to 1", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["check", "--max-agent-share", "1.5"],
        cwd: repo.root,
      });

      expect(result.stdout).toBe("");
      expect(result.exitCode).toBe(2);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga check in a shallow clone", () => {
  it.live.each([
    { output: "text", flags: [] },
    { output: "JSON", flags: ["--json"] },
  ])("exits 2 without evaluating any gate in $output output", ({ flags }) =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      const clone = yield* makeShallowClone(repo, 2);

      const result = yield* journey({
        args: ["check", "--min-truck-factor", "1", ...flags],
        cwd: clone,
      });

      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        "codesaga: check needs the full history: this is a shallow clone (run git fetch --unshallow, or use fetch-depth: 0 in actions/checkout)",
      );
      expect(result.exitCode).toBe(2);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga check and the TypeScript history", () => {
  it.live(
    "does not parse the history's TypeScript, which its gates never read",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;

        const checked = yield* journey({
          args: ["check", "--min-truck-factor", "1"],
          cwd: repo.root,
        });
        const cacheFile = join(repo.root, ".git", "codesaga", "syntax-v1.json");
        const afterCheck = existsSync(cacheFile);
        yield* journey({ args: ["analyze", "--json"], cwd: repo.root });

        expect(checked.exitCode).toBe(0);
        expect(afterCheck).toBe(false);
        expect(existsSync(cacheFile)).toBe(true);
      }).pipe(Effect.scoped),
  );
});

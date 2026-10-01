import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { Report } from "@codesaga/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import type { GitRepository } from "../testing/git-repository.js";
import { journey } from "../testing/journey-harness.js";
import { makeTeamProject } from "../testing/projects.js";

const decode = (stdout: string) =>
  Schema.decodeUnknownEffect(Report)(JSON.parse(stdout));

const writeConfig = (repo: GitRepository, config: unknown) => {
  writeFileSync(
    join(repo.root, ".codesaga.json"),
    typeof config === "string" ? config : JSON.stringify(config),
  );
};

const analyzeJson = (repo: GitRepository, ...flags: ReadonlyArray<string>) =>
  Effect.flatMap(
    journey({ args: ["analyze", "--json", ...flags], cwd: repo.root }),
    (result) => decode(result.stdout),
  );

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codesaga defaults from a .codesaga.json", () => {
  it.live("applies the config's since, and a --since flag overrides it", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      writeConfig(repo, { since: "30d" });

      const fromConfig = yield* analyzeJson(repo);
      const fromFlag = yield* analyzeJson(repo, "--since", "100d");

      expect(fromConfig.window.commits).toBe(3);
      expect(fromFlag.window.commits).toBe(4);
    }).pipe(Effect.scoped),
  );

  it.live(
    "applies the config's exclude, and an --exclude flag replaces it",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;
        const before = yield* analyzeJson(repo);
        writeConfig(repo, { exclude: ["src/**"] });

        const fromConfig = yield* analyzeJson(repo);
        const fromFlag = yield* analyzeJson(repo, "--exclude", "src/b.ts");

        expect(before.overview.files).toBe(2);
        expect(fromConfig.overview.files).toBe(0);
        expect(fromFlag.overview.files).toBe(1);
      }).pipe(Effect.scoped),
  );

  it.live("applies the config's limit to the JSON document", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      writeConfig(repo, { limit: 1 });

      const report = yield* analyzeJson(repo);

      expect(report.contributors).toHaveLength(1);
      expect(report.totals.contributors).toBe(2);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga signatures from a .codesaga.json", () => {
  it.live("reclassifies an in-house bot named in the config's signatures", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      repo.commit(
        3,
        { "src/c.ts": "c1\n" },
        { author: { name: "acme-ci", email: "ci@acme.example" } },
      );
      const before = yield* analyzeJson(repo);
      writeConfig(repo, {
        signatures: {
          bots: [{ name: "Acme CI", emails: ["CI@Acme.example"] }],
        },
      });

      const after = yield* analyzeJson(repo);

      expect(before.contributors.map(({ name }) => name)).toContain("acme-ci");
      expect(after.contributors.map(({ name }) => name)).not.toContain(
        "acme-ci",
      );
      expect(after.automation.tools).toContainEqual({
        name: "Acme CI",
        kind: "bot",
        authored: 1,
        assisted: 0,
      });
    }).pipe(Effect.scoped),
  );
});

describe("codesaga inspect with a .codesaga.json", () => {
  it.live("makes inspect honor the config's exclude", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      writeConfig(repo, { exclude: ["src/b.ts"] });

      const result = yield* journey({
        args: ["inspect", "src/b.ts", "--json"],
        cwd: repo.root,
      });

      expect(result.stdout).toBe("");
      expect(result.exitCode).toBe(4);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga with an invalid .codesaga.json", () => {
  it.live.each([
    {
      name: "an unknown key",
      config: '{"sinse":"6m"}',
      problem: "sinse: unknown key",
    },
    {
      name: "a value of the wrong type",
      config: '{"include":["src",2]}',
      problem: "include[1]: Expected string",
    },
    {
      name: "text that is not JSON",
      config: "{ include: }",
      problem: "Expected a valid JSON string",
    },
    {
      name: "a since the flag syntax rejects",
      config: '{"since":"soon"}',
      problem:
        'since: invalid "soon": use <n>d, <n>w, <n>m, <n>y or YYYY-MM-DD',
    },
  ])("exits 2 for $name, naming the file and the key", ({ config, problem }) =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      writeConfig(repo, config);

      const analyzed = yield* journey({
        args: ["analyze", "--json"],
        cwd: repo.root,
      });
      const inspected = yield* journey({
        args: ["inspect", "src/a.ts", "--json"],
        cwd: repo.root,
      });

      for (const result of [analyzed, inspected]) {
        expect(result.stdout).toBe("");
        expect(result.stderr).toBe(
          `codesaga: invalid ${repo.root}/.codesaga.json: ${problem}`,
        );
        expect(result.exitCode).toBe(2);
      }
    }).pipe(Effect.scoped),
  );

  it.live("lets a --since flag override a since the config gets wrong", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      writeConfig(repo, { since: "soon" });

      const report = yield* analyzeJson(repo, "--since", "30d");

      expect(report.window.commits).toBe(3);
    }).pipe(Effect.scoped),
  );
});

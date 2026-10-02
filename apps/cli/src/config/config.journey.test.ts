import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { Report } from "@codesaga/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import type { GitRepository } from "../testing/git-repository.js";
import { journey } from "../testing/journey-harness.js";
import {
  makeTerritoriesProject,
  makeTeamProject,
} from "../testing/projects.js";

const decode = (stdout: string) =>
  Schema.decodeUnknownEffect(Report)(JSON.parse(stdout));

const configPath = (repo: GitRepository) => join(repo.root, ".codesaga.json");

const writeConfig = (repo: GitRepository, config: unknown) => {
  writeFileSync(
    configPath(repo),
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

  it.live("lets --compare set the window instead of the config's since", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      // The first would give four commits, the second is no valid since at all.
      for (const since of ["100d", "soon"]) {
        writeConfig(repo, { since });

        const report = yield* analyzeJson(repo, "--compare", "45d");

        expect(report.window.commits).toBe(3);
        expect(report.comparison?.previous.commits).toBe(1);
      }
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

describe("codesaga territory detail from a .codesaga.json", () => {
  it.live(
    "starts at the recommended detail, the config's detail (or its deprecated depth), or the --detail flag, in that order of precedence",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTerritoriesProject;
        const startDetail = (...flags: ReadonlyArray<string>) =>
          Effect.map(analyzeJson(repo, ...flags), (report) => ({
            detail: report.knowledge.territories.detail,
            maxDetail: report.knowledge.territories.maxDetail,
          }));

        const recommended = yield* startDetail();
        writeConfig(repo, { detail: 2 });
        const fromConfig = yield* startDetail();
        const fromFlag = yield* startDetail("--detail", "1");
        writeConfig(repo, { depth: 2 });
        const fromDepthKey = yield* startDetail();
        writeConfig(repo, { detail: 1, depth: 2 });
        const detailOverDepth = yield* startDetail();

        expect(recommended).toStrictEqual({ detail: 1, maxDetail: 2 });
        expect(fromConfig).toStrictEqual({ detail: 2, maxDetail: 2 });
        expect(fromFlag).toStrictEqual({ detail: 1, maxDetail: 2 });
        expect(fromDepthKey).toStrictEqual({ detail: 2, maxDetail: 2 });
        expect(detailOverDepth).toStrictEqual({ detail: 1, maxDetail: 2 });
      }).pipe(Effect.scoped),
  );
});

describe("codesaga finds the .codesaga.json of the repository it analyzes", () => {
  it.live("reads the root's config when run from a subdirectory", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      writeConfig(repo, { since: "30d" });

      const result = yield* journey({
        args: ["analyze", "--json"],
        cwd: join(repo.root, "src"),
      });

      expect((yield* decode(result.stdout)).window.commits).toBe(3);
    }).pipe(Effect.scoped),
  );

  it.live("reads the other repository's config for a path argument", () =>
    Effect.gen(function* () {
      const here = yield* makeTeamProject;
      const other = yield* makeTeamProject;
      writeConfig(here, { since: "30d" });
      writeConfig(other, { limit: 1 });

      const result = yield* journey({
        args: ["analyze", "--json", relative(here.root, other.root)],
        cwd: here.root,
      });
      const report = yield* decode(result.stdout);

      expect(report.window.commits).toBe(5);
      expect(report.contributors).toHaveLength(1);
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
      name: "a signature with an empty email, which would match any author without one",
      config: '{"signatures":{"bots":[{"name":"x","emails":[""]}]}}',
      problem:
        "signatures.bots[0].emails[0]: Expected a value with a length of at least 1",
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

describe("codesaga with a .codesaga.json it cannot read", () => {
  it.live.each([
    {
      name: "a directory",
      arrange: (repo: GitRepository) => {
        mkdirSync(configPath(repo));
      },
      reason: "is not a regular file",
    },
    {
      name: "a symbolic link to a missing file",
      arrange: (repo: GitRepository) => {
        symlinkSync("missing.json", configPath(repo));
      },
      reason: "is a symbolic link to a missing file",
    },
    {
      name: "a symbolic link that points to itself",
      arrange: (repo: GitRepository) => {
        symlinkSync(".codesaga.json", configPath(repo));
      },
      reason: "cannot be read (BadResource)",
    },
    {
      name: "a file over 1 MiB",
      arrange: (repo: GitRepository) => {
        writeConfig(repo, " ".repeat(1024 * 1024 + 1));
      },
      reason: "is larger than 1 MiB",
    },
  ])(
    "exits 2 for $name, naming the file and the reason",
    ({ arrange, reason }) =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;
        arrange(repo);

        const result = yield* journey({
          args: ["analyze", "--json"],
          cwd: repo.root,
        });

        expect(result.stdout).toBe("");
        expect(result.stderr).toBe(
          `codesaga: invalid ${repo.root}/.codesaga.json: ${reason}`,
        );
        expect(result.exitCode).toBe(2);
      }).pipe(Effect.scoped),
  );
});

describe("codesaga blame from a .codesaga.json", () => {
  it.live(
    "turns line owners on with the config's blame, and --no-blame off",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;
        // A third file brings src into the report's directories.
        repo.commit(1, { "src/c.ts": "c1\n" });
        writeConfig(repo, { blame: true });

        const fromConfig = yield* analyzeJson(repo);
        const fromFlag = yield* analyzeJson(repo, "--no-blame");

        expect(fromConfig.knowledge.directories[0]?.lineOwners?.lines).toBe(7);
        expect(fromFlag.knowledge.directories[0]).not.toHaveProperty(
          "lineOwners",
        );
      }).pipe(Effect.scoped),
  );
});

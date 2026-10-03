import { existsSync } from "node:fs";

import { Report } from "@codesaga/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  breakBlameOf,
  makeShallowClone,
  makeTempDirectory,
} from "../testing/git-repository.js";
import { journey } from "../testing/journey-harness.js";
import {
  makeTerritoriesProject,
  makeTeamProject,
} from "../testing/projects.js";

const decode = (stdout: string) =>
  Schema.decodeUnknownEffect(Report)(JSON.parse(stdout));

// Real clock: the analysis window is resolved against now, and the commits are dated relative to it.
describe("codesaga analyze --json", () => {
  it.live(
    "prints one JSON document to stdout that decodes with the Report schema",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;

        const result = yield* journey({
          args: ["analyze", "--json"],
          cwd: repo.root,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe("");
        const report = yield* decode(result.stdout);
        expect(report.window.commits).toBe(5);
        expect(
          report.contributors.map(({ name, commits }) => [name, commits]),
        ).toStrictEqual([
          ["Ada Lovelace", 3],
          ["Grace", 1],
        ]);
        expect(report.automation.tools).toStrictEqual([
          { name: "Claude Code", kind: "agent", authored: 0, assisted: 1 },
          { name: "Dependabot", kind: "bot", authored: 1, assisted: 0 },
        ]);
      }).pipe(Effect.scoped),
  );

  it.live("truncates contributors to --limit and leaves totals untouched", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["analyze", "--json", "--limit", "1"],
        cwd: repo.root,
      });

      const report = yield* decode(result.stdout);
      expect(report.contributors.map(({ name }) => name)).toStrictEqual([
        "Ada Lovelace",
      ]);
      expect(report.totals.contributors).toBe(2);
    }).pipe(Effect.scoped),
  );

  it.live("narrows the activity to --since and keeps the first commit", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["analyze", "--json", "--since", "30d"],
        cwd: repo.root,
      });

      const report = yield* decode(result.stdout);
      expect(report.window.commits).toBe(3);
      expect(report.contributors.map(({ name }) => name)).toStrictEqual([
        "Ada Lovelace",
        "Grace",
      ]);
      expect(report.repository.firstCommitAt).not.toBeNull();
    }).pipe(Effect.scoped),
  );
});

describe("codesaga analyze --detail", () => {
  it.live(
    "starts the territories at --detail and at the deepest detail when it is beyond",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTerritoriesProject;
        const startAt = (flag: "--detail" | "--depth", value: string) =>
          Effect.gen(function* () {
            const result = yield* journey({
              args: ["analyze", "--json", flag, value],
              cwd: repo.root,
            });
            return (yield* decode(result.stdout)).knowledge.territories;
          });

        const second = yield* startAt("--detail", "2");
        const beyond = yield* startAt("--detail", "9");
        const viaDepthAlias = yield* startAt("--depth", "2");

        expect(second.detail).toBe(2);
        expect(viaDepthAlias.detail).toBe(2);
        expect(second.recommendedDetail).toBe(1);
        expect(beyond.detail).toBe(2);
        expect(beyond.maxDetail).toBe(2);
      }).pipe(Effect.scoped),
  );

  it.live("rejects a --detail below 1 as a usage error", () =>
    Effect.gen(function* () {
      const repo = yield* makeTerritoriesProject;

      const result = yield* journey({
        args: ["analyze", "--json", "--detail", "0"],
        cwd: repo.root,
      });

      expect(result.stdout).toBe("");
      expect(result.exitCode).toBe(2);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga analyze --compare", () => {
  it.live(
    "carries both windows and the deltas in the JSON, decoding with the Report schema",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;

        const result = yield* journey({
          args: ["analyze", "--json", "--compare", "45d"],
          cwd: repo.root,
        });

        expect(result.exitCode).toBe(0);
        const { window, comparison } = yield* decode(result.stdout);
        // 20, 10 and 5 days ago against 60 days ago
        expect(window.commits).toBe(3);
        expect(comparison?.previous.commits).toBe(1);
        expect(comparison?.current.activeContributors).toBe(2);
        expect(comparison?.delta.commits).toStrictEqual({
          change: 2,
          ratio: 2,
        });
        expect(comparison?.previous.until).toBe(window.since);
      }).pipe(Effect.scoped),
  );

  it.live("adds the deltas to the terminal summary", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["analyze", "--compare", "45d"],
        cwd: repo.root,
      });

      expect(result.stdout).toMatch(
        /^vs \d{4}-\d{2}-\d{2} – \d{4}-\d{2}-\d{2} · commits \+200% · contributors \+1 · lines added \+300% · AI share \+33 pts$/mu,
      );
    }).pipe(Effect.scoped),
  );
});

describe("codesaga analyze paths", () => {
  it.live("counts only commits under a path argument", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["analyze", "src/b.ts", "--json"],
        cwd: repo.root,
      });

      const report = yield* decode(result.stdout);
      expect(report.repository.scope).toBe("src/b.ts");
      expect(report.window.commits).toBe(1);
    }).pipe(Effect.scoped),
  );

  it.live("analyzes a repository given as a path from outside it", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      const elsewhere = yield* makeTempDirectory;

      const result = yield* journey({
        args: ["analyze", repo.root, "--json"],
        cwd: elsewhere,
      });

      expect(result.exitCode).toBe(0);
      const report = yield* decode(result.stdout);
      expect(report.repository.scope).toBe(".");
      expect(report.window.commits).toBe(5);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga analyze summary", () => {
  it.live(
    "prints the terminal summary without ANSI codes when not on a TTY",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;

        const result = yield* journey({ args: ["analyze"], cwd: repo.root });

        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain("\u001B");
        expect(result.stdout).toContain("· main @ ");
        expect(result.stdout).toContain(
          "1 year · 5 commits · 2 contributors, 2 active in 90 days",
        );
        expect(result.stdout).toContain("Ada Lovelace");
        expect(result.stdout).toContain("agent-assisted 20% · bot 20%");
        expect(result.stdout).toContain("Claude Code 1 · Dependabot 1");
        expect(
          result.stdout
            .trimEnd()
            .endsWith("--html for the dashboard, --json for agents"),
        ).toBe(true);
      }).pipe(Effect.scoped),
  );

  it.live("styles the summary on a terminal unless NO_COLOR is set", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const colored = yield* journey({
        args: ["analyze"],
        cwd: repo.root,
        stdoutIsTerminal: true,
      });
      const plain = yield* journey({
        args: ["analyze"],
        cwd: repo.root,
        stdoutIsTerminal: true,
        env: { NO_COLOR: "1" },
      });

      expect(colored.stdout).toContain("\u001B[");
      expect(plain.stdout).not.toContain("\u001B");
    }).pipe(Effect.scoped),
  );
});

describe("codesaga analyze a shallow clone", () => {
  it.live(
    "warns on stderr, keeps stdout to the JSON and leaves out the boundary commit",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;
        const clone = yield* makeShallowClone(repo, 2);

        const result = yield* journey({
          args: ["analyze", "--json"],
          cwd: clone,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toContain("shallow clone");
        const report = yield* decode(result.stdout);
        expect(report.repository.shallow).toBe(true);
        expect(report.window.commits).toBe(1);
      }).pipe(Effect.scoped),
  );
});

describe("codesaga analyze --no-cache", () => {
  it.live("reads git every time and leaves no cache in the repository", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      const cacheFile = `${repo.root}/.git/codesaga/history-v2.json`;

      const uncached = yield* journey({
        args: ["analyze", "--json", "--no-cache"],
        cwd: repo.root,
      });
      expect(uncached.exitCode).toBe(0);
      expect(existsSync(cacheFile)).toBe(false);

      const cached = yield* journey({
        args: ["analyze", "--json"],
        cwd: repo.root,
      });
      expect(cached.exitCode).toBe(0);
      expect(existsSync(cacheFile)).toBe(true);
    }).pipe(Effect.scoped),
  );
});

// The team project's src has two files; a third brings the directory into the report.
// Ada wrote a.ts (3 lines), Grace b.ts and c.ts (3 + 2 lines).
describe("codesaga analyze --blame", () => {
  const grace = { name: "Grace", email: "grace@example.com" };

  it.live("adds the line owners of each directory to the JSON report", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      repo.commit(1, { "src/c.ts": "c1\nc2\n" }, { author: grace });

      const result = yield* journey({
        args: ["analyze", "--json", "--blame"],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      const report = yield* decode(result.stdout);
      expect(report.knowledge.directories[0]?.lineOwners).toStrictEqual({
        skippedFiles: 0,
        lines: 8,
        owners: [
          {
            name: "Grace",
            email: "grace@example.com",
            lines: 5,
            share: 0.625,
            kind: "human",
          },
          {
            name: "Ada Lovelace",
            email: "ada@example.com",
            lines: 3,
            share: 0.375,
            kind: "human",
          },
        ],
      });
    }).pipe(Effect.scoped),
  );

  it.live(
    "shows the leading line owner next to the expert in the summary",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;
        repo.commit(1, { "src/c.ts": "c1\nc2\n" }, { author: grace });

        const result = yield* journey({
          args: ["analyze", "--blame"],
          cwd: repo.root,
        });

        expect(result.stdout).toContain("leading line owner");
        expect(result.stdout).toContain("Grace 63%");
      }).pipe(Effect.scoped),
  );
});

describe("codesaga analyze --blame a file git cannot blame", () => {
  const grace = { name: "Grace", email: "grace@example.com" };

  it.live(
    "warns once on stderr when git blame failed for a file and still prints the JSON",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;
        repo.commit(1, { "src/c.ts": "c1\nc2\n" }, { author: grace });
        breakBlameOf(repo, "src/a.ts");

        const result = yield* journey({
          args: ["analyze", "--json", "--blame"],
          cwd: repo.root,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe(
          "codesaga: git blame failed for 1 file; line owners cover the rest",
        );
        const report = yield* decode(result.stdout);
        expect(report.knowledge.lineOwners).toMatchObject({
          skippedFiles: 1,
          lines: 5,
        });
      }).pipe(Effect.scoped),
  );

  it.live("leaves the JSON without line owners when not asked", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      repo.commit(1, { "src/c.ts": "c1\nc2\n" }, { author: grace });

      const result = yield* journey({
        args: ["analyze", "--json"],
        cwd: repo.root,
      });

      expect(result.stdout).not.toContain("lineOwners");
    }).pipe(Effect.scoped),
  );
});

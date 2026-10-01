import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { InspectResult, Report } from "@codesaga/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { CheckResult } from "../check/check-result.js";
import { startMcpSession } from "../testing/mcp-session.js";
import { makeTeamProject } from "../testing/projects.js";

const ToolList = Schema.Struct({
  tools: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      inputSchema: Schema.Struct({
        required: Schema.optionalKey(Schema.Array(Schema.String)),
      }),
    }),
  ),
});

// The team project has two contributors besides Dependabot, a truck factor of 2
// and 1 of 5 commits co-authored by an agent. Real clock: its commits are dated relative to now.
describe("codesaga mcp discovery and inspect", () => {
  it.live(
    "lists analyze, inspect and check with inspect requiring patterns",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;
        const session = yield* startMcpSession(repo.root);

        const { tools } = yield* Schema.decodeUnknownEffect(ToolList)(
          yield* session.request("tools/list"),
        );

        expect(
          tools.map(({ name, inputSchema }) => [
            name,
            inputSchema.required ?? [],
          ]),
        ).toStrictEqual([
          ["analyze", []],
          ["inspect", ["patterns"]],
          ["check", []],
        ]);
      }).pipe(Effect.scoped),
  );

  it.live(
    "answers inspect with a document that decodes with InspectResult",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;
        const session = yield* startMcpSession(repo.root);

        const result = yield* session.callTool("inspect", {
          patterns: ["src/*.ts", "missing.ts"],
        });

        expect(result.isError).toBe(false);
        const inspected = yield* Schema.decodeUnknownEffect(InspectResult)(
          result.structuredContent,
        );
        expect(JSON.parse(result.content[0]?.text ?? "")).toStrictEqual(
          result.structuredContent,
        );
        expect(inspected.matches).toHaveLength(1);
        expect(inspected.matches[0]).toMatchObject({
          pattern: "src/*.ts",
          files: 2,
        });
        expect(inspected.unmatched).toStrictEqual(["missing.ts"]);
      }).pipe(Effect.scoped),
  );
});

describe("codesaga mcp analyze", () => {
  it.live(
    "answers analyze with a Report that honors limit and the repository's config",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;
        writeFileSync(join(repo.root, ".codesaga.json"), '{"limit":1}');
        const session = yield* startMcpSession(repo.root);

        const fromConfig = yield* session.callTool("analyze", {});
        const overridden = yield* session.callTool("analyze", { limit: 0 });

        const decode = Schema.decodeUnknownEffect(Report);
        const limited = yield* decode(fromConfig.structuredContent);
        const unlimited = yield* decode(overridden.structuredContent);
        expect(limited.contributors).toHaveLength(1);
        expect(unlimited.contributors).toHaveLength(2);
        expect(unlimited.window.commits).toBe(5);
      }).pipe(Effect.scoped),
  );

  it.live("compares windows when analyze is given compare", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      const session = yield* startMcpSession(repo.root);

      const result = yield* session.callTool("analyze", { compare: "45d" });

      const report = yield* Schema.decodeUnknownEffect(Report)(
        result.structuredContent,
      );
      expect(report.window.commits).toBe(3);
      expect(report.comparison?.previous.commits).toBe(1);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga mcp check", () => {
  it.live("reports a failed gate in the check document, not as an error", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      const session = yield* startMcpSession(repo.root);

      const result = yield* session.callTool("check", {
        minTruckFactor: 3,
        maxOrphanedDirectories: 0,
      });

      expect(result.isError).toBe(false);
      const check = yield* Schema.decodeUnknownEffect(CheckResult)(
        result.structuredContent,
      );
      expect(check.passed).toBe(false);
      expect(
        check.gates.map(({ name, passed }) => [name, passed]),
      ).toStrictEqual([
        ["minTruckFactor", false],
        ["maxOrphanedDirectories", true],
      ]);
    }).pipe(Effect.scoped),
  );

  it.live("takes check's gates from the repository's config", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      writeFileSync(
        join(repo.root, ".codesaga.json"),
        '{"gates":{"minTruckFactor":2}}',
      );
      const session = yield* startMcpSession(repo.root);

      const result = yield* session.callTool("check", {});

      const check = yield* Schema.decodeUnknownEffect(CheckResult)(
        result.structuredContent,
      );
      expect(check.passed).toBe(true);
      expect(check.gates.map(({ name }) => name)).toStrictEqual([
        "minTruckFactor",
      ]);
    }).pipe(Effect.scoped),
  );
});

describe("codesaga mcp tool errors", () => {
  it.live("fails a tool call with the line the command line would print", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;
      const session = yield* startMcpSession(repo.root);

      const noGates = yield* session.callTool("check", {});
      const badSince = yield* session.callTool("analyze", { since: "soon" });
      const noMatch = yield* session.callTool("inspect", {
        patterns: ["nope.ts"],
      });

      expect(
        [noGates, badSince, noMatch].map(({ isError, content }) => [
          isError,
          content[0]?.text,
        ]),
      ).toStrictEqual([
        [
          true,
          'no gates configured: pass a gate flag such as --min-truck-factor, or set "gates" in .codesaga.json',
        ],
        [
          true,
          'invalid --since "soon": use <n>d, <n>w, <n>m, <n>y or YYYY-MM-DD',
        ],
        [
          true,
          'no file matches "nope.ts" (patterns are relative to the repository root)',
        ],
      ]);
    }).pipe(Effect.scoped),
  );
});

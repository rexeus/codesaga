import { Report } from "@codesaga/engine";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { sourceProgram } from "../testing/child-program.js";
import { makeGitRepository } from "../testing/git-repository.js";
import { journey } from "../testing/journey-harness.js";
import { makeTeamProject } from "../testing/projects.js";
import { makeOxcParserLayer } from "../typescript/oxc-parser.js";

const decode = (stdout: string) =>
  Schema.decodeUnknownEffect(Report)(JSON.parse(stdout));

describe("codesaga analyze --json deep dive", () => {
  it.live(
    "reports the coverage of the TypeScript the real parser read, and only the JSON on stdout",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTeamProject;

        const result = yield* journey({
          args: ["analyze", "--json"],
          cwd: repo.root,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe("");
        const coverage = (yield* decode(result.stdout)).deepDives?.typescript
          ?.coverage;
        expect(coverage).toMatchObject({
          files: 2,
          parsed: 2,
          declarationFiles: 0,
          skipped: {},
          parser: { name: "oxc-parser" },
        });
        expect(coverage?.parser.version).toMatch(/^\d+\.\d+\.\d+$/u);
        expect(coverage).not.toHaveProperty("unavailable");
      }).pipe(Effect.scoped),
  );

  it.live(
    "leaves out the deep dive for a repository without TypeScript or JavaScript",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeGitRepository;
        repo.commit(5, { "main.py": "print(1)\n" });

        const result = yield* journey({
          args: ["analyze", "--json"],
          cwd: repo.root,
        });

        expect(result.exitCode).toBe(0);
        expect(JSON.parse(result.stdout)).not.toHaveProperty("deepDives");
      }).pipe(Effect.scoped),
  );

  it.live("does not load the parser for inspect", () =>
    Effect.gen(function* () {
      const repo = yield* makeTeamProject;

      const result = yield* journey({
        args: ["inspect", "src/a.ts", "--json"],
        cwd: repo.root,
      });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).not.toHaveProperty("deepDives");
    }).pipe(Effect.scoped),
  );
});

describe("codesaga analyze --json when a file crashes the parser", () => {
  it.live(
    // Whether this payload crashes the native parser or overflows the walker
    // depends on the machine's stack size; either way the run survives.
    "still produces the JSON when a file is too deep to parse, and counts it",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeGitRepository;
        repo.commit(5, {
          "src/a.ts": "export const a = 1;\n",
          "src/b.ts": "export const b = 2;\n",
          "src/hostile.ts": `x = ${"a ?\nb :\n".repeat(20_000)}c;\n`,
        });

        const result = yield* journey({
          args: ["analyze", "--json"],
          cwd: repo.root,
          parser: makeOxcParserLayer(sourceProgram()),
        });

        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe("");
        const coverage = (yield* decode(result.stdout)).deepDives?.typescript
          ?.coverage;
        expect(coverage).toMatchObject({ files: 3, parsed: 2 });
        const skipped = Object.entries(coverage?.skipped ?? {});
        expect(skipped).toHaveLength(1);
        expect(["parser-crashed", "too-deep"]).toContain(skipped[0]?.[0]);
        expect(skipped[0]?.[1]).toBe(1);
      }).pipe(Effect.scoped),
    60_000,
  );
});

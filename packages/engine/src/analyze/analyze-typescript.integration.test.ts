import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import {
  TypeScriptParser,
  unavailableParser,
} from "../typescript/typescript-parser.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const NESTED = `${"[\n".repeat(2_000)}${"]\n".repeat(2_000)}`;

const commitScripts = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit("2026-02-01T09:00:00Z", {
    "src/a.ts": "export const a = 1;\n",
    "src/b.ts": "export const b: number = 2;\n",
    "src/view.js": "export const view = <p>hi</p>;\n",
    "src/nested.ts": NESTED,
    "types/api.d.ts": "export declare const api: string;\n",
    "README.md": "# not code\n",
  });
  return repo;
});

layer(analyzeServices)("analyze the TypeScript deep dive", (it) => {
  it.effect(
    "counts parsed files, declaration files and skipped files by reason",
    () =>
      Effect.gen(function* () {
        const repo = yield* commitScripts;

        const { deepDives } = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(deepDives?.typescript?.coverage, {
          files: 5,
          parsed: 3,
          declarationFiles: 1,
          skipped: { "too-deep": 1 },
          parser: { name: "oxc-parser", version: "test" },
        });
      }),
  );

  it.effect("reads the work tree, so an uncommitted edit counts", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repo = yield* commitScripts;
      yield* fs.writeFileString(
        path.join(repo.directory, "src/b.ts"),
        "export const b = ;\n",
      );

      const { deepDives } = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(deepDives?.typescript?.coverage.skipped, {
        "syntax-error": 1,
        "too-deep": 1,
      });
      assert.strictEqual(deepDives?.typescript?.coverage.parsed, 2);
    }),
  );
});

layer(analyzeServices)("analyze the TypeScript deep dive without it", (it) => {
  it.effect(
    "has no deep dive for a repository without TypeScript or JavaScript",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-02-01T09:00:00Z", {
          "main.py": "print(1)\n",
          "README.md": "# hi\n",
        });

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.notProperty(report, "deepDives");
      }),
  );

  it.effect(
    "degrades to the coverage when the parser did not load, and still reports everything else",
    () =>
      Effect.gen(function* () {
        const repo = yield* commitScripts;

        const report = yield* analyze(analyzeOptionsFor(repo)).pipe(
          Effect.provideService(
            TypeScriptParser,
            unavailableParser("oxc-parser", "Cannot find native binding"),
          ),
        );

        assert.deepStrictEqual(report.deepDives?.typescript?.coverage, {
          files: 5,
          parsed: 0,
          declarationFiles: 1,
          skipped: { "parser-unavailable": 4 },
          parser: { name: "oxc-parser", version: null },
          unavailable: "Cannot find native binding",
        });
        assert.strictEqual(report.overview.files, 5);
      }),
  );
});

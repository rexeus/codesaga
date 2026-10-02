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

// A left-deep chain: no brackets, and deeper than a walk can follow.
const NESTED = `x = 1\n${"+1\n".repeat(30_000)}`;

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

layer(analyzeServices)(
  "analyze the TypeScript deep dive's type safety",
  (it) => {
    it.effect(
      "counts escape hatches of production code and tests apart, and per territory",
      () =>
        Effect.gen(function* () {
          yield* setNow;
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-02-01T09:00:00Z", {
            "app/a.ts": "export const a = (x: unknown) => x as any;\n",
            "app/b.ts": "// @ts-nocheck\nexport const b = 1;\n",
            "app/c.ts": "export const c = 1;\n",
            "app/a.test.ts": "export const t = (x: unknown) => x!;\n",
            "lib/d.ts": "export const d = 1;\n",
            "lib/e.ts": "export const e = 1;\n",
            "lib/f.ts": "export const f = 1;\n",
          });

          const report = yield* analyze(analyzeOptionsFor(repo));

          const { typeSafety } = report.deepDives?.typescript ?? {};
          assert.deepStrictEqual(typeSafety?.nocheckFiles, ["app/b.ts"]);
          assert.deepStrictEqual(
            [typeSafety?.production.files, typeSafety?.production.escapes],
            [6, 2],
          );
          assert.deepStrictEqual(
            [typeSafety?.tests.files, typeSafety?.tests.counts.nonNull],
            [1, 1],
          );
          const byPath = Object.fromEntries(
            report.knowledge.territories.territories.map((territory) => [
              territory.path,
              territory.typescript,
            ]),
          );
          assert.deepStrictEqual(byPath["lib"], {
            files: 3,
            codeLines: 3,
            escapesPer1000: 0,
            esmShare: 1,
            imports: [],
            importedBy: [],
            inCycle: false,
          });
          assert.strictEqual(byPath["app"]?.files, 4);
          assert.strictEqual(byPath["app"]?.escapesPer1000, 500);
        }),
    );
  },
);

layer(analyzeServices)(
  "analyze the TypeScript deep dive's code style",
  (it) => {
    it.effect(
      "reports the module systems, the idioms and the stack of a repository",
      () =>
        Effect.gen(function* () {
          yield* setNow;
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-02-01T09:00:00Z", {
            "package.json": JSON.stringify({
              name: "app",
              type: "module",
              dependencies: { react: "^19", effect: "^4" },
              devDependencies: { vitest: "^3" },
            }),
            "test/fixture/package.json": '{ "dependencies": { "vue": "^3" } }',
            "src/view.tsx":
              'import { useState } from "react";\nimport type { Props } from "./props";\nexport const View = (p: Props) => { const [a] = useState(p); return <p>{a}</p>; };\n',
            "src/props.ts": "export interface Props { a: number }\n",
            "src/main.ts":
              'import { Effect } from "effect";\nimport fs from "node:fs";\nexport default Effect.succeed(fs);\n',
            "src/legacy.cjs":
              'const x = require("lodash");\nmodule.exports = { x };\n',
            "src/view.test.ts":
              'import { it } from "vitest";\nit("works", () => {});\n',
          });

          const { deepDives } = yield* analyze(analyzeOptionsFor(repo));

          const typescript = deepDives?.typescript;
          assert.deepStrictEqual(typescript?.modules, {
            files: 5,
            esmFiles: 4,
            commonjsFiles: 1,
            bothFiles: 0,
            imports: { declarations: 5, typeOnly: 1 },
            nonErasable: {
              files: 0,
              enums: 0,
              namespaces: 0,
              parameterProperties: 0,
              decorators: 0,
            },
            packageTypes: { module: 1, commonjs: 0, unspecified: 0 },
          });
          assert.deepStrictEqual(
            typescript?.ecosystem?.tools.map(({ name }) => name),
            ["Effect", "React", "Vitest"],
          );
          assert.deepStrictEqual(
            [typescript?.ecosystem?.dependencies, typescript?.ecosystem?.hooks],
            [
              { manifests: 1, runtime: 2, dev: 1 },
              { calls: 1, files: 1 },
            ],
          );
        }),
    );
  },
);

const HARD = [
  "/** Hard. */",
  "export function hard(c: boolean) {",
  ...Array.from({ length: 16 }, () => "  if (c) {}"),
  "}",
  "// TODO: split",
].join("\n");

const commitThreeTimes = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit("2026-02-01T09:00:00Z", {
    "package.json": '{ "devDependencies": { "vitest": "^3" } }',
    "src/hard.ts": `${HARD}\n`,
    "src/easy.ts": "export const easy = () => 1;\n",
    "src/hard.test.ts":
      'import { it } from "vitest";\nit.only("hard", () => { expect(1).toBe(1); });\n',
  });
  yield* repo.commit("2026-02-02T09:00:00Z", {
    "src/hard.ts": `${HARD}\n// second\n`,
    "src/easy.ts": "export const easy = () => 2;\n",
  });
  yield* repo.commit("2026-02-03T09:00:00Z", {
    "src/hard.ts": `${HARD}\n// third\n`,
  });
  return repo;
});

layer(analyzeServices)("analyze the TypeScript deep dive's functions", (it) => {
  it.effect(
    "joins the revisions of three commits to the hardest function of each file",
    () =>
      Effect.gen(function* () {
        const repo = yield* commitThreeTimes;

        const { deepDives } = yield* analyze(analyzeOptionsFor(repo));

        const typescript = deepDives?.typescript;
        assert.deepStrictEqual(typescript?.complexityAndChange, {
          files: 2,
          revisions: 5,
          complexFiles: 1,
          complexRevisions: 3,
          complexRevisionShare: 0.6,
          hotspots: [{ path: "src/hard.ts", complexity: 16, revisions: 3 }],
        });
        assert.deepStrictEqual(typescript?.functions?.production.top, [
          {
            name: "hard",
            path: "src/hard.ts",
            line: 2,
            complexity: 16,
            lines: 18,
          },
        ]);
        assert.deepStrictEqual(
          typescript?.functions?.production.complexity.bands,
          [1, 0, 0, 1, 0],
        );
      }),
  );
});

layer(analyzeServices)("analyze the TypeScript deep dive's tests", (it) => {
  it.effect("reports the tests and the markers of a repository", () =>
    Effect.gen(function* () {
      const repo = yield* commitThreeTimes;

      const report = yield* analyze(analyzeOptionsFor(repo));

      const typescript = report.deepDives?.typescript;
      assert.deepStrictEqual(typescript?.tests, {
        files: 1,
        frameworks: ["Vitest"],
        cases: 1,
        parameterized: 0,
        skipped: 0,
        focused: 1,
        todo: 0,
        focusedFiles: ["src/hard.test.ts"],
        assertions: [0, 1, 0, 0],
        snapshots: 0,
        typeTests: 0,
      });
      assert.deepStrictEqual(typescript?.markers, {
        files: 2,
        lines: 22,
        todo: 1,
        fixme: 0,
        hack: 0,
        xxx: 0,
        deprecated: 0,
        exportedDeclarations: 2,
        documentedExports: 1,
        documentedShare: 0.5,
      });
      assert.strictEqual(report.thresholds.typescript?.complexityLimit, 15);
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

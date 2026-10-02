import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { servicesWithoutParser } from "../testing/no-parser.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { inspect } from "./inspect.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const commitProject = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit("2026-02-01T09:00:00Z", {
    "tsconfig.json": '{ "compilerOptions": { "strict": true } }\n',
    "src/core.ts":
      "// @ts-ignore\nexport const core = (a: boolean, b: boolean, x: unknown) => {\n  if (a) {\n    if (b) {\n      return x as any;\n    }\n  }\n  return 1;\n};\n",
    "src/a.ts": 'import { core } from "./core";\nexport const a = core;\n',
    "src/b.ts": 'import { core } from "./core.js";\nexport const b = core;\n',
    "src/c.ts": "export const c = 1;\n",
    "src/d.ts":
      "// it's a comment with an apostrophe\nimport { core } from './core';\nexport const d = core;\n",
    "src/decoy.ts":
      '// not an import: "./core"\nexport const note = "./core";\n',
    "test/core.test.ts":
      'import { core } from "../src/core";\nit("works", () => { core(true, true, 1); });\n',
    "README.md": "# hi\n",
  });
  return repo;
});

layer(analyzeServices)("inspect the TypeScript of an argument", (it) => {
  it.effect(
    "tells who imports a file and which test covers it, without counting a string that only looks like an import",
    () =>
      Effect.gen(function* () {
        const repo = yield* commitProject;

        const { matches } = yield* inspect({
          ...analyzeOptionsFor(repo),
          patterns: ["src/core.ts"],
        });

        assert.deepStrictEqual(matches[0]?.typescript, {
          files: 1,
          unparsed: 0,
          maxComplexity: 3,
          complexFunctions: 0,
          hardest: [],
          escapes: 2,
          directives: 1,
          importedBy: { files: 3, top: ["src/a.ts", "src/b.ts", "src/d.ts"] },
          testedBy: { files: 1, top: ["test/core.test.ts"] },
          strict: true,
        });
      }),
  );

  it.effect(
    "leaves the importers inside a directory out of its importedBy and keeps its tests",
    () =>
      Effect.gen(function* () {
        const repo = yield* commitProject;

        const { matches } = yield* inspect({
          ...analyzeOptionsFor(repo),
          patterns: ["src"],
        });

        const typescript = matches[0]?.typescript;
        assert.deepStrictEqual(typescript?.importedBy, { files: 0, top: [] });
        assert.deepStrictEqual(typescript?.testedBy, {
          files: 1,
          top: ["test/core.test.ts"],
        });
        assert.strictEqual(typescript?.files, 6);
      }),
  );

  it.effect(
    "has no TypeScript figures for an argument without such a file",
    () =>
      Effect.gen(function* () {
        const repo = yield* commitProject;

        const { matches } = yield* inspect({
          ...analyzeOptionsFor(repo),
          patterns: ["README.md"],
        });

        assert.notProperty(matches[0] ?? {}, "typescript");
      }),
  );
});

layer(servicesWithoutParser)("inspect without a parser", (it) => {
  it.effect("answers everything but the TypeScript figures", () =>
    Effect.gen(function* () {
      const repo = yield* commitProject;

      const { matches } = yield* inspect({
        ...analyzeOptionsFor(repo),
        patterns: ["src/core.ts"],
      });

      assert.strictEqual(matches[0]?.files, 1);
      assert.notProperty(matches[0] ?? {}, "typescript");
    }),
  );
});

import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const workspace = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit("2026-02-01T09:00:00Z", {
    "packages/a/package.json":
      '{ "name": "@acme/a", "exports": { ".": "./dist/index.js" } }\n',
    "packages/a/src/index.ts": 'export { p } from "./p.js";\n',
    "packages/a/src/p.ts":
      'import { q } from "./q.js";\nexport const p: number = q + 1;\n',
    "packages/a/src/q.ts":
      'import { p } from "./p.js";\nexport const q: number = typeof p === "number" ? 1 : 0;\n',
    "packages/a/src/p.test.ts":
      'import { p } from "./p.js";\nexport const t = p;\n',
    "packages/b/package.json": '{ "name": "@acme/b" }\n',
    "packages/b/src/main.ts":
      'import { p } from "@acme/a";\nimport { helper } from "./helper.js";\nimport missing from "./generated.js";\nimport fs from "node:fs";\nexport const m = [p, helper, missing, fs];\n',
    "packages/b/src/helper.ts": "export const helper = 1;\n",
    "packages/b/src/util.ts":
      'import type { T } from "@acme/a/missing";\nexport type U = T;\n',
  });
  return repo;
});

layer(analyzeServices)("analyze the import structure", (it) => {
  it.effect(
    "reports the cycle between two files of a package, with the unresolved specifiers",
    () =>
      Effect.gen(function* () {
        const { deepDives } = yield* analyze(
          analyzeOptionsFor(yield* workspace),
        );

        const files = deepDives?.typescript?.imports?.files;
        assert.deepStrictEqual(files?.cycles, {
          count: 1,
          largest: 2,
          top: [
            {
              size: 2,
              files: ["packages/a/src/p.ts", "packages/a/src/q.ts"],
              territories: 1,
            },
          ],
          withTypes: { count: 1, largest: 2 },
          typeOnly: 0,
        });
      }),
  );
});

layer(analyzeServices)("analyze the unresolved specifiers", (it) => {
  it.effect(
    "counts the specifiers that point into the repository where no file is",
    () =>
      Effect.gen(function* () {
        const { deepDives } = yield* analyze(
          analyzeOptionsFor(yield* workspace),
        );

        const files = deepDives?.typescript?.imports?.files;
        assert.deepStrictEqual(files?.unresolved, {
          count: 2,
          share: 0.25,
          top: [
            { specifier: "./generated.js", files: 1 },
            { specifier: "@acme/a/missing", files: 1 },
          ],
        });
        assert.deepStrictEqual(
          [files?.edges, files?.external, files?.files, files?.testFiles],
          [{ value: 5, typeOnly: 0, tests: 1 }, 1, 6, 1],
        );
      }),
  );

  it.effect(
    "maps the territories and marks each with what it imports and what imports it",
    () =>
      Effect.gen(function* () {
        const { deepDives, knowledge } = yield* analyze(
          analyzeOptionsFor(yield* workspace),
        );

        const map = deepDives?.typescript?.imports?.territories;
        const a = { path: "packages/a", kind: "package" } as const;
        const b = { path: "packages/b", kind: "package" } as const;
        assert.deepStrictEqual(map?.territories, [
          { ...a, files: 3, ca: 1, ce: 0, instability: 0 },
          { ...b, files: 3, ca: 0, ce: 1, instability: 1 },
        ]);
        assert.deepStrictEqual(map?.edges, [
          { from: b, to: a, files: 1, typeOnlyFiles: 0 },
        ]);
        assert.deepStrictEqual(
          knowledge.territories.territories.map(({ path, typescript }) => [
            path,
            typescript?.imports,
            typescript?.importedBy,
            typescript?.inCycle,
          ]),
          [
            ["packages/a", [], [b], false],
            ["packages/b", [a], [], false],
          ],
        );
      }),
  );
});

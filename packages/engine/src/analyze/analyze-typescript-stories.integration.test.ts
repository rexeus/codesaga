import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

/** Fifty strict, any-free production files in `src`, and one test file that commits a focused test. */
const commitTypedProject = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit("2026-02-01T09:00:00Z", {
    "tsconfig.json":
      '{ "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": true } }\n',
    "test/core.test.ts": 'it.only("works", () => {});\n',
    ...Object.fromEntries(
      Array.from({ length: 50 }, (_, index) => [
        `src/f${index}.ts`,
        `export const f${index} = ${index};\n`,
      ]),
    ),
  });
  return repo;
});

layer(analyzeServices)("analyze the stories of the TypeScript code", (it) => {
  it.effect("tells of a committed focused test", () =>
    Effect.gen(function* () {
      const repo = yield* commitTypedProject;

      const { stories } = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(
        stories.filter(({ kind }) => kind === "focused-test"),
        [
          {
            kind: "focused-test",
            title: "Focused test",
            detail:
              "1 focused test committed in test/core.test.ts: the runner skips every other test while one stays.",
            value: 1,
            path: "test/core.test.ts",
          },
        ],
      );
    }),
  );

  it.effect(
    "reaches the four state achievements of a clean project, with tightened still ahead",
    () =>
      Effect.gen(function* () {
        const repo = yield* commitTypedProject;

        const { deepDives } = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          deepDives?.typescript?.achievements?.map(({ kind, reached }) => [
            kind,
            reached,
          ]),
          [
            ["any-free", true],
            ["strict-throughout", true],
            ["esm-only", true],
            ["no-ts-ignore", true],
            ["tightened", false],
          ],
        );
      }),
  );
});

layer(analyzeServices)("analyze the badges of the TypeScript code", (it) => {
  it.effect(
    "badges the territory of the clean project as type-safe and strict",
    () =>
      Effect.gen(function* () {
        const repo = yield* commitTypedProject;

        const { knowledge } = yield* analyze(analyzeOptionsFor(repo));

        const src = knowledge.territories.territories.find(
          ({ path }) => path === "src",
        );
        assert.deepStrictEqual(
          src?.badges.filter(
            ({ kind }) => kind === "type-safe" || kind === "strict",
          ),
          [
            {
              kind: "type-safe",
              category: "code",
              label: "Type-safe",
              evidence:
                "50 production TypeScript files with 0.0 escape hatches per 1,000 production lines.",
            },
            {
              kind: "strict",
              category: "code",
              label: "Strict",
              evidence:
                "Every tsconfig that governs its files sets strict and noUncheckedIndexedAccess.",
            },
          ],
        );
      }),
  );
});

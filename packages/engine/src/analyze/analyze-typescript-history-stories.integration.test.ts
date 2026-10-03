import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const NON_NULL = "export const f = (x: number | undefined) => x!;\n";
const CLEAN = "export const f = (x: number) => x;\n";

const files = (prefix: string, count: number, content: string) =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `${prefix}${index}.ts`,
      content,
    ]),
  );

/**
 * January 2025: 25 files with a non-null assertion each, 10 CommonJS files
 * and a config with strict off. March 2025: 20 of the assertions go, the
 * CommonJS files are deleted and strict is turned on.
 */
const commitTighteningHistory = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit("2025-01-10T09:00:00Z", {
    "tsconfig.json": '{ "compilerOptions": { "strict": false } }\n',
    ...files("src/f", 25, NON_NULL),
    ...Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [
        `lib/c${index}.cjs`,
        "module.exports = 1;\n",
      ]),
    ),
  });
  yield* repo.git("rm", "--quiet", "-r", "--", "lib");
  yield* repo.commit("2025-03-10T09:00:00Z", {
    "tsconfig.json": '{ "compilerOptions": { "strict": true } }\n',
    ...files("src/f", 20, CLEAN),
  });
  return repo;
});

layer(analyzeServices)("analyze the stories the history tells", (it) => {
  it.effect(
    "tells since when strict is on and since when the code is ESM only",
    () =>
      Effect.gen(function* () {
        const repo = yield* commitTighteningHistory;

        const { stories } = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          stories.filter(
            ({ kind }) => kind === "strict-since" || kind === "module-era",
          ),
          [
            {
              kind: "strict-since",
              title: "Strict since",
              detail: "strict was switched on in tsconfig.json on 2025-03-10.",
              value: 12,
              date: "2025-03-10",
              path: "tsconfig.json",
            },
            {
              kind: "module-era",
              title: "ESM only",
              detail: "No production file has used CommonJS since 2025-03.",
              value: 0,
              date: "2025-03-01",
            },
          ],
        );
      }),
  );

  it.effect("reaches tightened on the day the escapes fell by half", () =>
    Effect.gen(function* () {
      const repo = yield* commitTighteningHistory;

      const { deepDives } = yield* analyze(analyzeOptionsFor(repo));

      const tightened = deepDives?.typescript?.achievements?.find(
        ({ kind }) => kind === "tightened",
      );
      assert.deepStrictEqual(
        [tightened?.reached, tightened?.reachedAt, tightened?.holds],
        [true, "2025-03-31", "milestone"],
      );
    }),
  );
});

const config = (strict: boolean, indexed: boolean) =>
  `{ "compilerOptions": { "strict": ${strict}, "noUncheckedIndexedAccess": ${indexed} } }\n`;

/** Strict is turned on first; then 22 commits flip noUncheckedIndexedAccess, so the newest 20 events do not reach back to it. */
const commitManyFlips = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit("2025-01-10T09:00:00Z", {
    "tsconfig.json": config(false, false),
    "src/a.ts": CLEAN,
  });
  yield* repo.commit("2025-01-20T09:00:00Z", {
    "tsconfig.json": config(true, false),
  });
  for (let index = 0; index < 22; index++) {
    yield* repo.commit(
      `2025-02-${String(index + 1).padStart(2, "0")}T09:00:00Z`,
      {
        "tsconfig.json": config(true, index % 2 === 0),
      },
    );
  }
  return repo;
});

layer(analyzeServices)(
  "analyze strict-since over a long history of flips",
  (it) => {
    it.effect(
      "still names the oldest flip that holds, which the newest 20 events no longer hold",
      () =>
        Effect.gen(function* () {
          const repo = yield* commitManyFlips;

          const { stories, deepDives } = yield* analyze(
            analyzeOptionsFor(repo),
          );

          assert.strictEqual(deepDives?.typescript?.trends?.events.length, 20);
          assert.isFalse(
            deepDives?.typescript?.trends?.events.some(
              ({ flag }) => flag === "strict",
            ) ?? true,
          );
          assert.deepStrictEqual(
            stories.find(({ kind }) => kind === "strict-since")?.date,
            "2025-01-20",
          );
        }),
    );
  },
);

import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-20T00:00:00Z"));

const anys = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => `export const v${index}: any = 1;\n`,
  ).join("");

/** January adds 3 `any` and a strict config, February nothing, March removes 2 `any` and turns strict on. */
const commitAnyHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2026-01-15T09:00:00Z", {
      "src/a.ts": anys(3),
      "src/a.test.ts": "it('works', () => {});\n",
      "tsconfig.json": '{ "compilerOptions": { "strict": false } }',
    });
    yield* repo.commit(
      "2026-03-10T09:00:00Z",
      {
        "src/a.ts": anys(1),
        "tsconfig.json": '{ "compilerOptions": { "strict": true } }',
      },
      { message: "tighten\n\nCo-authored-by: Claude <noreply@anthropic.com>" },
    );
  });

layer(analyzeServices)("analyze trends", (it) => {
  it.effect("replays the history by month and ends on the counts of HEAD", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitAnyHistory(repo);

      const { deepDives } = yield* analyze(analyzeOptionsFor(repo));

      const trends = deepDives?.typescript?.trends;
      assert.deepStrictEqual(trends?.months, ["2026-01", "2026-02", "2026-03"]);
      assert.deepStrictEqual(trends?.series["production.any"], [3, 3, 1]);
      assert.deepStrictEqual(trends?.series["production.files"], [1, 1, 1]);
      assert.deepStrictEqual(trends?.series["tests.testCases"], [1, 1, 1]);
      assert.strictEqual(
        trends?.series["production.any"]?.at(-1),
        deepDives?.typescript?.typeSafety?.production.counts.any,
      );
    }),
  );

  it.effect(
    "reports the strict flip with its date and the escapes each class added and removed",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitAnyHistory(repo);

        const { deepDives } = yield* analyze(analyzeOptionsFor(repo));

        const trends = deepDives?.typescript?.trends;
        assert.deepStrictEqual(trends?.events, [
          {
            date: "2026-03-10",
            path: "tsconfig.json",
            flag: "strict",
            from: false,
            to: true,
          },
        ]);
        assert.deepStrictEqual(trends?.escapesByAutomation, {
          human: { commits: 1, added: 3, removed: 0 },
          "agent-assisted": { commits: 1, added: 0, removed: 2 },
          agent: { commits: 0, added: 0, removed: 0 },
          bot: { commits: 0, added: 0, removed: 0 },
        });
      }),
  );

  it.effect("has no trends when the history is not parsed", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitAnyHistory(repo);

      const { deepDives } = yield* analyze(
        analyzeOptionsFor(repo, { typescriptHistory: false }),
      );

      assert.isUndefined(deepDives?.typescript?.trends);
    }),
  );
});

layer(analyzeServices)("analyze trends of a merged history", (it) => {
  it.effect(
    "holds no ghost file after a clean merge of a rename and an edit",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-01-10T09:00:00Z", { "src/a.ts": anys(12) });
        yield* repo.git("checkout", "-q", "-b", "side");
        yield* repo.git("mv", "src/a.ts", "src/b.ts");
        yield* repo.commit("2026-01-20T09:00:00Z");
        yield* repo.git("checkout", "-q", "-");
        yield* repo.commit("2026-02-10T09:00:00Z", { "src/a.ts": anys(14) });
        yield* repo.git("merge", "--no-ff", "--no-edit", "side");

        const { deepDives } = yield* analyze(analyzeOptionsFor(repo));

        const series = deepDives?.typescript?.trends?.series;
        assert.deepStrictEqual(series?.["production.files"], [1, 1, 1]);
        assert.deepStrictEqual(series?.["production.any"], [12, 14, 14]);
      }),
  );
});

layer(analyzeServices)("analyze trends of a shallow clone", (it) => {
  it.effect(
    "starts at the boundary commit, which adds the tree it cut off, and ends on HEAD",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-01-15T09:00:00Z", { "src/a.ts": anys(3) });
        yield* repo.commit("2026-01-20T09:00:00Z", { "src/b.ts": anys(1) });
        yield* repo.commit("2026-02-10T09:00:00Z", { "src/a.ts": anys(5) });
        yield* repo.commit("2026-03-10T09:00:00Z", { "src/a.ts": anys(1) });
        yield* repo.git(
          "clone",
          "--quiet",
          "--depth=3",
          `file://${repo.directory}`,
          "clone",
        );

        const { deepDives } = yield* analyze(
          analyzeOptionsFor({ directory: `${repo.directory}/clone` }),
        );

        const trends = deepDives?.typescript?.trends;
        assert.deepStrictEqual(trends?.months, [
          "2026-01",
          "2026-02",
          "2026-03",
        ]);
        // b.ts, which no visible commit touches, is in the boundary commit's tree.
        assert.deepStrictEqual(trends?.series["production.any"], [4, 6, 2]);
        assert.deepStrictEqual(trends?.series["production.files"], [2, 2, 2]);
      }),
  );
});

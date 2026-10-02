import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { countingParser } from "../testing/history-facts.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

/** a.ts has two versions and b.ts one: three blobs in the history, two files at HEAD. */
const commitVersions = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit("2026-02-01T09:00:00Z", {
    "a.ts": "export const a = 1;\n",
    "b.ts": "export const b = 1;\n",
  });
  yield* repo.commit("2026-02-02T09:00:00Z", {
    "a.ts": "export const a = 2;\n",
  });
  return repo;
});

const analyzeCounting = (
  repo: Parameters<typeof analyzeOptionsFor>[0],
  overrides: Parameters<typeof analyzeOptionsFor>[1],
) => {
  const parser = countingParser();
  return analyze(analyzeOptionsFor(repo, overrides)).pipe(
    Effect.provide(Layer.mergeAll(NodeServices.layer, parser.layer)),
    Effect.map(() => parser.parsed()),
  );
};

layer(NodeServices.layer)("analyze with typescriptHistory", (it) => {
  it.effect("parses the history's blobs and caches them by default", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repo = yield* commitVersions;

      const parsed = yield* analyzeCounting(repo, {});

      // Two files at HEAD, then the three blobs of the history.
      assert.strictEqual(parsed, 5);
      assert.isTrue(
        yield* fs.exists(`${repo.directory}/.git/codesaga/syntax-v1.json`),
      );
    }),
  );

  it.effect(
    "parses only HEAD and leaves the facts cache alone when told not to read the history",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* commitVersions;

        const parsed = yield* analyzeCounting(repo, {
          typescriptHistory: false,
        });

        assert.strictEqual(parsed, 2);
        assert.isFalse(
          yield* fs.exists(`${repo.directory}/.git/codesaga/syntax-v1.json`),
        );
      }),
  );
});

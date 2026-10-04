import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer } from "effect";

import {
  countingParser,
  gatherOf,
  recordingServices,
} from "../../testing/history-facts.js";
import { makeTempRepository } from "../../testing/temp-repository.js";
import type { TempRepository } from "../../testing/temp-repository.js";
import { trendsOf } from "./trends.js";

const now = DateTime.makeUnsafe("2026-04-15T00:00:00Z");

/** The default branch, and an unrelated history of two commits that is older than the commit it starts from. */
const commitHistories = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2026-03-10T12:00:00Z", {
      "app.ts": "export const app = 1;\n",
    });
    const main = (yield* repo.git("branch", "--show-current")).trim();
    yield* repo.git("switch", "--orphan", "other");
    yield* repo.commit("2026-01-05T12:00:00Z", {
      "lib.ts": "export const lib: any = 1;\n",
    });
    yield* repo.commit("2026-02-02T12:00:00Z", {
      "lib.ts": "export const lib: any = 1;\nexport const more: any = 2;\n",
    });
    yield* repo.git("switch", main);
  });

const trendsAfter = (repo: TempRepository, scope: string) =>
  Effect.gen(function* () {
    const parser = countingParser();
    const services = recordingServices(repo);
    const facts = yield* gatherOf(repo).pipe(
      Effect.provide(Layer.mergeAll(parser.layer, services.layer)),
    );
    assert.isDefined(facts);
    return trendsOf({ historyFacts: facts, window: [], scope, now });
  });

layer(NodeServices.layer)("trendsOf over an absorbed history", (it) => {
  it.effect(
    "starts with the absorbed history and ends in the head's tree without counting the absorbed files twice",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitHistories(repo);
        yield* repo.git(
          "merge",
          "--no-commit",
          "--allow-unrelated-histories",
          "other",
        );
        yield* repo.commit("2026-03-20T12:00:00Z");

        const result = yield* trendsAfter(repo, ".");

        assert.deepStrictEqual(result?.trends.months, [
          "2026-01",
          "2026-02",
          "2026-03",
          "2026-04",
        ]);
        assert.deepStrictEqual(
          result?.trends.series["production.files"],
          [1, 1, 2, 2],
        );
        assert.deepStrictEqual(
          result?.trends.series["production.any"],
          [1, 2, 2, 2],
        );
        assert.deepStrictEqual(result?.lastCommitDays, [
          "2026-01-05",
          "2026-02-02",
          "2026-03-20",
          "2026-03-20",
        ]);
      }),
  );
});

layer(NodeServices.layer)(
  "trendsOf over a history merged under a directory",
  (it) => {
    it.effect(
      "reads the files of a history merged under a directory by their path in the scope that holds them",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* commitHistories(repo);
          yield* repo.git(
            "merge",
            "-s",
            "ours",
            "--no-commit",
            "--allow-unrelated-histories",
            "other",
          );
          yield* repo.git("read-tree", "--prefix=lib/", "-u", "other");
          yield* repo.commit("2026-03-20T12:00:00Z");

          const result = yield* trendsAfter(repo, "lib");

          assert.deepStrictEqual(result?.trends.months, [
            "2026-01",
            "2026-02",
            "2026-03",
            "2026-04",
          ]);
          assert.deepStrictEqual(
            result?.trends.series["production.files"],
            [1, 1, 1, 1],
          );
          assert.deepStrictEqual(
            result?.trends.series["production.any"],
            [1, 2, 2, 2],
          );
        }),
    );
  },
);

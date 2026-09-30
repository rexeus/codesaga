import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { readHistory } from "./history.js";

const history = (repo: TempRepository) =>
  Effect.gen(function* () {
    const head = (yield* repo.git("rev-parse", "HEAD")).trim();
    return yield* readHistory({
      root: repo.directory,
      head,
      shallowBoundary: new Set(),
      useCache: false,
    });
  }).pipe(Effect.provide(Git.layer(repo.directory)));

/** main and feature fork after a.ts, each add a file, and feature is merged back with a merge commit. */
const commitMergedBranches = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "a\n" });
    yield* repo.git("switch", "--create", "feature");
    yield* repo.commit("2026-03-02T12:00:00Z", { "b.ts": "b\n" });
    yield* repo.git("switch", "-");
    yield* repo.commit("2026-03-03T12:00:00Z", { "c.ts": "c\n" });
    yield* repo.git("merge", "--no-ff", "--no-edit", "feature");
  });

layer(NodeServices.layer)("readHistory with merge commits", (it) => {
  it.effect(
    "reports the commits of both branches and not the merge, with the changes each made",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitMergedBranches(repo);

        const { commits } = yield* history(repo);

        assert.deepStrictEqual(
          commits.map(({ changes }) => changes.map(({ path }) => path)),
          [["c.ts"], ["b.ts"], ["a.ts"]],
        );
      }),
  );

  it.effect("dates HEAD by its own author time when HEAD is a merge", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitMergedBranches(repo);
      const mergeTime = Number(
        (yield* repo.git("log", "-1", "--format=%at", "HEAD")).trim(),
      );

      const { headTime } = yield* history(repo);

      assert.strictEqual(headTime, mergeTime);
      assert.isAbove(mergeTime, Date.parse("2026-03-04T00:00:00Z") / 1000);
    }),
  );
});

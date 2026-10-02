import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const lines = (prefix: string, count: number): string =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}\n`).join("");

/**
 * 31 commits from 2026-01-01 to 2026-01-31, one a day:
 *  1  five languages and a 1,100-line `src/big.ts`, three test files
 *  2  deletes `src/big.ts`, 1,100 lines
 *  3+ a note each day, so a commit on each of the 31 days
 */
const commitHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2026-01-01T09:00:00Z", {
      "src/big.ts": lines("big", 1100),
      "src/a.test.ts": lines("a", 20),
      "src/b.test.ts": lines("b", 20),
      "src/c.test.ts": lines("c", 20),
      "tools/run.py": lines("py", 20),
      "tools/run.rb": lines("rb", 20),
      "tools/run.go": lines("go", 20),
      "tools/run.rs": lines("rs", 20),
    });
    yield* repo.git("rm", "--quiet", "src/big.ts");
    yield* repo.commit("2026-01-02T09:00:00Z");
    for (let day = 3; day <= 31; day += 1) {
      yield* repo.commit(`2026-01-${String(day).padStart(2, "0")}T09:00:00Z`, {
        "notes.txt": `day ${day}\n`,
      });
    }
  });

const reachedOf = (
  achievements: ReadonlyArray<{
    kind: string;
    reached: boolean;
    reachedAt: string | null;
  }>,
) =>
  achievements
    .filter(({ reached }) => reached)
    .map(({ kind, reachedAt }) => [kind, reachedAt]);

layer(NodeServices.layer)("analyze achievements", (it) => {
  it.effect(
    "reads the achievements off a real history, with the day each milestone was first passed",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitHistory(repo);

        const { achievements, thresholds } = yield* analyze(
          analyzeOptionsFor(repo),
        );

        assert.deepStrictEqual(reachedOf(achievements), [
          ["polyglot", "2026-01-01"],
          ["test-culture", null],
          ["unbroken", "2026-01-30"],
          ["spring-cleaning", "2026-01-02"],
        ]);
        assert.deepStrictEqual(
          achievements.find(({ kind }) => kind === "first-commits")?.progress,
          { value: 31, target: 1000, unit: "commits" },
        );
        assert.strictEqual(thresholds.achievements.unbrokenDays, 30);
      }),
  );
});

layer(NodeServices.layer)("analyze achievements window", (it) => {
  it.effect(
    "keeps the achievements of the whole history when the window is narrowed",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitHistory(repo);

        const all = yield* analyze(analyzeOptionsFor(repo));
        const narrow = yield* analyze(
          analyzeOptionsFor(repo, { since: "2026-02-01" }),
        );

        assert.deepStrictEqual(narrow.achievements, all.achievements);
      }),
  );
});

layer(NodeServices.layer)("analyze achievements shallow", (it) => {
  it.effect(
    "withholds the days and the states that need the full history in a shallow clone",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* makeTempRepository;
        yield* commitHistory(repo);
        const clone = `${yield* fs.makeTempDirectoryScoped()}/clone`;
        yield* repo.git(
          "clone",
          "--quiet",
          "--depth",
          "5",
          `file://${repo.directory}`,
          clone,
        );

        const { achievements, repository } = yield* analyze(
          analyzeOptionsFor({ directory: clone }),
        );

        assert.isTrue(repository.shallow);
        // the files at HEAD still show five languages and tests; no day can be told
        assert.deepStrictEqual(reachedOf(achievements), [
          ["polyglot", null],
          ["test-culture", null],
        ]);
        assert.deepStrictEqual(
          achievements.find(({ kind }) => kind === "fresh-blood"),
          {
            kind: "fresh-blood",
            title: "Fresh blood",
            reached: false,
            reachedAt: null,
            holds: "state",
            detail: "Needs the full history, and this clone is shallow.",
            progress: null,
          },
        );
      }),
  );
});

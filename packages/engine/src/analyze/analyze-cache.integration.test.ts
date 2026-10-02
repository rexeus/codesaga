import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

// Ten distinct lines keep a file similar enough for git to detect a rename.
const tenLines = Array.from(
  { length: 10 },
  (_, index) => `line ${index}\n`,
).join("");

const cacheFileOf = (repo: TempRepository) =>
  `${repo.directory}/.git/codesaga/history-v1.json`;

/** Analyzes twice, with and without the cache, and requires the same report. */
const analyzeBothWays = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* setNow;
    const cached = yield* analyze(analyzeOptionsFor(repo));
    const uncached = yield* analyze(analyzeOptionsFor(repo, { cache: false }));
    assert.deepStrictEqual(cached, uncached);
    return cached;
  });

/**
 * The cache is written at the head of main; a branch forked before it and
 * dated between its commits, which renames a file main edits later, is then
 * merged, so the commits since the cached head are older than the cached ones.
 */
const commitMainThenMergeOlderBranch = (repo: TempRepository) =>
  Effect.gen(function* () {
    const ada = { name: "Ada", email: "ada@example.com" };
    const bob = { name: "Bob", email: "bob@example.com" };
    yield* repo.commit("2026-03-01T12:00:00Z", { "x.ts": tenLines });
    yield* repo.commit(
      "2026-03-05T12:00:00Z",
      { "x.ts": `${tenLines}main\n` },
      { author: ada },
    );
    yield* analyzeBothWays(repo);

    yield* repo.git("switch", "--create", "feature", "HEAD~1");
    yield* repo.git("mv", "x.ts", "y.ts");
    yield* repo.commit("2026-03-02T12:00:00Z", {}, { author: bob });
    yield* repo.commit(
      "2026-03-03T12:00:00Z",
      { "y.ts": `feature\n${tenLines}` },
      { author: bob },
    );
    yield* repo.git("switch", "-");
    yield* repo.git("merge", "--no-ff", "--no-edit", "feature");
    yield* analyzeBothWays(repo);
  });

layer(analyzeServices)("analyze with the history cache", (it) => {
  it.effect(
    "reports what an uncached run reports after the history grew, was rewritten, or the mailmap changed",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "a.ts": tenLines,
          "b.ts": "b\n",
        });
        yield* analyzeBothWays(repo);

        yield* repo.git("mv", "a.ts", "c.ts");
        yield* repo.commit("2026-03-02T12:00:00Z", {
          "c.ts": `${tenLines}more\n`,
        });
        yield* analyzeBothWays(repo);

        yield* repo.git(
          "commit",
          "--amend",
          "--allow-empty",
          "--message",
          "amended",
        );
        yield* analyzeBothWays(repo);

        yield* fs.writeFileString(
          `${repo.directory}/.mailmap`,
          "Mapped Name <test@codesaga.invalid>\n",
        );
        const report = yield* analyzeBothWays(repo);

        assert.deepStrictEqual(
          report.contributors.map(({ name }) => name),
          ["Mapped Name"],
        );
      }),
  );

  it.effect(
    "reports what an uncached run reports when a branch forked before the cached head is merged after it",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitMainThenMergeOlderBranch(repo);
      }),
  );

  it.effect("writes the cache into the git directory unless told not to", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "a\n" });
      yield* setNow;

      yield* analyze(analyzeOptionsFor(repo, { cache: false }));
      assert.isFalse(yield* fs.exists(cacheFileOf(repo)));

      yield* analyze(analyzeOptionsFor(repo));
      assert.isTrue(yield* fs.exists(cacheFileOf(repo)));
    }),
  );
});

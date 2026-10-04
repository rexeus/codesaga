import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const ADDED = "// adds\nexport const a = {\n  b: 1,\n};\n";

/**
 * Four commits:
 *  1  "feat: add a"          src/a.ts (4 lines), src/a.test.ts (1 line)
 *  2  "Tidy things"          src/a.ts gains a line, src/b.ts is added
 *  3  "fix(a)!: rename b"    src/b.ts becomes src/c.ts
 *  4  "chore: bump"          src/c.ts gains a line
 */
const commitHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit(
      "2026-02-01T09:00:00Z",
      { "src/a.ts": ADDED, "src/a.test.ts": "test(a);\n" },
      { message: "feat: add a" },
    );
    yield* repo.commit(
      "2026-02-02T09:00:00Z",
      {
        "src/a.ts": `${ADDED}export const z = 2;\n`,
        "src/b.ts": "export const b = 1;\n",
      },
      { message: "Tidy things" },
    );
    yield* repo.git("mv", "src/b.ts", "src/c.ts");
    yield* repo.commit(
      "2026-02-03T09:00:00Z",
      {},
      { message: "fix(a)!: rename b" },
    );
    yield* repo.commit(
      "2026-02-04T09:00:00Z",
      { "src/c.ts": "export const b = 1;\nexport const d = 2;\n" },
      { message: "chore: bump" },
    );
  });

/** The report of the history of `commitHistory` as of 2026-03-10. */
const reportOfHistory = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* commitHistory(repo);
  return yield* analyze(analyzeOptionsFor(repo));
});

layer(analyzeServices)("analyze stats", (it) => {
  it.effect("counts the files at HEAD and the revisions of renamed files", () =>
    Effect.gen(function* () {
      const { stats } = yield* reportOfHistory;

      assert.deepStrictEqual(
        [stats.files, stats.codeLines, stats.tests],
        [3, 8, { files: 1, lines: 1 }],
      );
      assert.deepStrictEqual(stats.fileLength.median, 2);
      // src/c.ts keeps the revisions of src/b.ts: added, renamed, bumped
      assert.deepStrictEqual(stats.churn.mostChanged, [
        { path: "src/c.ts", revisions: 3 },
        { path: "src/a.ts", revisions: 2 },
        { path: "src/a.test.ts", revisions: 1 },
      ]);
      assert.deepStrictEqual(
        [stats.churn.revisions, stats.churn.revisionLines],
        [6, 17],
      );
    }),
  );

  it.effect("measures complexity and style and the habits of the window", () =>
    Effect.gen(function* () {
      const { stats } = yield* reportOfHistory;

      assert.deepStrictEqual(
        [stats.complexity.perLine, stats.complexity.deepestLevel],
        [0.125, 1],
      );
      assert.deepStrictEqual(stats.style, {
        indent: { spacesShare: 1, tabsShare: 0, width: 2 },
        lineLength: { median: 13, p90: 19 },
        commentLines: { lines: 1, share: 0.125 },
        // the rename moved no line, so three commits changed code: 5, 2 and 1 lines
        conventionalCommits: { commits: 4, conventional: 3, share: 0.75 },
        commitSize: { commits: 3, median: 2, p90: 4.4 },
      });
    }),
  );
});

layer(analyzeServices)("analyze territory stats", (it) => {
  it.effect(
    "gives a territory the stats of its own files, without the repository's commit habits",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitHistory(repo);
        yield* repo.commit(
          "2026-02-05T09:00:00Z",
          { "docs/x.ts": "x\n", "docs/y.ts": "y\n", "docs/z.ts": "z\n" },
          { message: "docs: add x, y and z" },
        );

        const report = yield* analyze(analyzeOptionsFor(repo));
        const { territories } = report.knowledge.territories;
        const src = territories.find(({ path }) => path === "src");

        assert.deepStrictEqual(src?.stats.files, 3);
        assert.deepStrictEqual(src?.stats.codeLines, 8);
        assert.deepStrictEqual(src?.stats.churn.revisions, 6);
        assert.deepStrictEqual(src?.stats.style.conventionalCommits, undefined);
        assert.deepStrictEqual(src?.stats.style.commitSize, undefined);
        assert.deepStrictEqual(src?.stats.fileLength.histogram, undefined);
        assert.deepStrictEqual(src?.stats.churn.histogram, undefined);
        assert.deepStrictEqual(src?.stats.complexity.histogram, undefined);
        assert.deepStrictEqual(
          report.stats.fileLength.histogram,
          [6, 0, 0, 0, 0, 0],
        );
        assert.deepStrictEqual(report.stats.files, 6);
        assert.deepStrictEqual(
          territories.reduce((sum, { stats }) => sum + stats.files, 0),
          report.stats.files,
        );
      }),
  );
});

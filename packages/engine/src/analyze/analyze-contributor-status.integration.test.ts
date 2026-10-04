import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const lines = (prefix: string, count: number): string =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}\n`).join("");

const ada = { name: "Ada Lovelace", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };

layer(analyzeServices)("analyze contributor status", (it) => {
  it.effect(
    "judges a contributor as new by their first commit ever, not by the first in a narrowed window",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit(
          "2025-10-01T09:00:00Z",
          { "src/a.ts": lines("a", 3) },
          { author: ada },
        );
        yield* repo.commit(
          "2026-03-02T09:00:00Z",
          { "src/a.ts": lines("a", 5) },
          { author: ada },
        );
        yield* repo.commit(
          "2026-03-03T09:00:00Z",
          { "src/b.ts": lines("b", 2) },
          { author: grace },
        );

        const report = yield* analyze(
          analyzeOptionsFor(repo, { since: "30d" }),
        );

        assert.deepStrictEqual(
          report.contributors.map((c) => [c.name, c.status]),
          [
            ["Ada Lovelace", "active"],
            ["Grace", "new"],
          ],
        );
      }),
  );
});

layer(analyzeServices)("analyze the all-time contributors", (it) => {
  it.effect(
    "counts the contributors of the full history under a narrowed window",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit(
          "2025-10-01T09:00:00Z",
          { "src/a.ts": lines("a", 3) },
          { author: grace },
        );
        yield* repo.commit(
          "2026-03-02T09:00:00Z",
          { "src/a.ts": lines("a", 5) },
          { author: ada },
        );

        const { overview } = yield* analyze(
          analyzeOptionsFor(repo, { since: "30d" }),
        );

        assert.deepStrictEqual(
          [overview.contributors.total, overview.contributors.allTime],
          [1, 2],
        );
      }),
  );
});

layer(analyzeServices)("analyze contributor status and the overview", (it) => {
  it.effect(
    "calls only the contributors of the overview's 90 days active or new, though an expert counts for 183",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit(
          "2025-10-01T09:00:00Z",
          { "src/a.ts": lines("a", 3) },
          { author: ada },
        );
        // 120 days before now: out of the 90 days, within the expert's 183
        yield* repo.commit(
          "2025-11-10T09:00:00Z",
          { "src/b.ts": lines("b", 2) },
          { author: grace },
        );
        yield* repo.commit(
          "2026-03-02T09:00:00Z",
          { "src/a.ts": lines("a", 5) },
          { author: ada },
        );

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          report.contributors.map((c) => [c.name, c.status, c.active]),
          [
            ["Ada Lovelace", "active", true],
            ["Grace", "dormant", true],
          ],
        );
        assert.strictEqual(report.overview.contributors.active90, 1);
      }),
  );
});

layer(analyzeServices)("analyze stories", (it) => {
  it.effect(
    "reports a streak and a rename record read off the whole history",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": lines("a", 10) });
        for (const [day, from, to] of [
          ["02", "a.ts", "b.ts"],
          ["03", "b.ts", "c.ts"],
          ["04", "c.ts", "d.ts"],
        ] as const) {
          yield* repo.git("mv", from, to);
          yield* repo.commit(`2026-03-${day}T12:00:00Z`);
        }
        for (const day of ["05", "06", "07"]) {
          yield* repo.commit(`2026-03-${day}T12:00:00Z`, {
            "d.ts": `${lines("a", 10)}${day}\n`,
          });
        }

        const { stories } = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          stories.map(({ kind, value, date, path }) => [
            kind,
            value,
            date,
            path,
          ]),
          [
            ["streak", 7, "2026-03-01", undefined],
            ["rename-record", 3, undefined, "d.ts"],
          ],
        );
      }),
  );
});

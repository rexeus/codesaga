import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { fieldsOf } from "../testing/error-fields.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { InvalidCompare } from "./analysis-window.js";
import { analyze } from "./analyze.js";

// --compare 30d: the window starts 2026-02-08T00:00Z, the previous span 2026-01-09T00:00Z.
const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const lines = (prefix: string, count: number): string =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}\n`).join("");

const ada = { name: "Ada", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };
const linus = { name: "Linus", email: "linus@example.com" };
const dependabot = {
  name: "dependabot[bot]",
  email: "49699333+dependabot[bot]@users.noreply.github.com",
};

/**
 *  1  01-05 before both spans  Ada  adds src/a.ts (10 lines) and a lockfile
 *  2  01-09 00:00:00Z, previous.since  Ada  appends 2 lines to src/a.ts
 *  3  01-20  Grace  adds src/b.ts (5 lines)
 *  4  02-07 23:59:59Z, last second before the window  Dependabot  changes the lockfile
 *  5  02-08 00:00:00Z, window.since  Grace  appends 3 lines to src/b.ts, co-authored by Claude
 *  6  02-20  Linus  adds src/c.ts (4 lines)
 *  7  03-05  Ada  appends 1 line to src/a.ts
 */
const commitAroundTheBoundary = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit(
      "2026-01-05T09:00:00Z",
      { "src/a.ts": lines("a", 10), "pnpm-lock.yaml": lines("lock", 20) },
      { author: ada },
    );
    yield* repo.commit(
      "2026-01-09T00:00:00Z",
      { "src/a.ts": lines("a", 12) },
      { author: ada },
    );
    yield* repo.commit(
      "2026-01-20T12:00:00Z",
      { "src/b.ts": lines("b", 5) },
      { author: grace },
    );
    yield* repo.commit(
      "2026-02-07T23:59:59Z",
      { "pnpm-lock.yaml": lines("lock", 30) },
      { author: dependabot },
    );
    yield* repo.commit(
      "2026-02-08T00:00:00Z",
      { "src/b.ts": lines("b", 8) },
      {
        author: grace,
        message:
          "Extend b\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>",
      },
    );
    yield* repo.commit(
      "2026-02-20T12:00:00Z",
      { "src/c.ts": lines("c", 4) },
      { author: linus },
    );
    yield* repo.commit(
      "2026-03-05T12:00:00Z",
      { "src/a.ts": lines("a", 13) },
      { author: ada },
    );
  });

const expectedComparison = {
  previous: {
    since: "2026-01-09T00:00:00.000Z",
    until: "2026-02-08T00:00:00.000Z",
    partial: false,
    commits: 3,
    activeContributors: 2,
    added: 7,
    deleted: 0,
    automation: { human: 2, agentAssisted: 0, agent: 0, bot: 1 },
    aiShare: 0,
  },
  current: {
    commits: 3,
    activeContributors: 3,
    added: 8,
    deleted: 0,
    automation: { human: 2, agentAssisted: 1, agent: 0, bot: 0 },
    aiShare: 0.3333,
  },
  delta: {
    commits: { change: 0, ratio: 0 },
    activeContributors: { change: 1, ratio: 0.5 },
    // 1 / 7
    added: { change: 1, ratio: 0.1429 },
    deleted: { change: 0, ratio: null },
    aiShare: 0.3333,
  },
};

layer(NodeServices.layer)("analyze --compare", (it) => {
  it.effect(
    "splits the history at the window start and reports both spans and the deltas",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitAroundTheBoundary(repo);

        const report = yield* analyze(
          analyzeOptionsFor(repo, { compare: "30d" }),
        );

        assert.deepStrictEqual(report.window, {
          since: "2026-02-08T00:00:00.000Z",
          until: "2026-03-10T00:00:00.000Z",
          commits: 3,
        });
        assert.deepStrictEqual(report.comparison, expectedComparison);
      }),
  );

  it.effect(
    "marks a previous span that starts before the first commit as partial",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitAroundTheBoundary(repo);

        // 60d: the window starts 2026-01-09, the previous span 2025-11-10, before the first commit on 2026-01-05
        const report = yield* analyze(
          analyzeOptionsFor(repo, { compare: "60d" }),
        );

        assert.strictEqual(report.comparison?.previous.partial, true);
        assert.strictEqual(report.comparison?.previous.commits, 1);
      }),
  );

  it.effect("leaves the comparison out without --compare", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitAroundTheBoundary(repo);

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.notProperty(report, "comparison");
    }),
  );

  it.effect("rejects --compare together with --since", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitAroundTheBoundary(repo);

      const failure = yield* Effect.flip(
        analyze(analyzeOptionsFor(repo, { compare: "30d", since: "60d" })),
      );

      assert.deepStrictEqual(
        fieldsOf(failure),
        fieldsOf(new InvalidCompare({ input: "30d", reason: "withSince" })),
      );
    }),
  );
});

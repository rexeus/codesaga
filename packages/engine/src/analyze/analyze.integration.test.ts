import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const lines = (prefix: string, count: number): string =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}\n`).join("");

const ada = { name: "Ada Lovelace", email: "ada@example.com" };
const adaOldEmail = { name: "Ada Lovelace", email: "ada@old.example" };
const grace = { name: "Grace", email: "grace@example.com" };
const linus = { name: "Linus", email: "linus@example.com" };
const dependabot = {
  name: "dependabot[bot]",
  email: "49699333+dependabot[bot]@users.noreply.github.com",
};

/**
 * Eight commits by three humans and Dependabot:
 *  1  Mon 01-05 09:00Z  Ada     adds src/a.ts (10 lines), a lockfile and .mailmap
 *  2  Tue 01-06 10:00+02:00  Ada, old email   appends 2 lines to src/a.ts
 *  3  Tue 02-03 23:30-05:00  Grace  adds src/b.ts (5 lines)
 *  4  Tue 02-10 12:00Z  Dependabot  changes the lockfile
 *  5  Mon 03-02 12:00Z  Grace  appends 3 lines to src/b.ts, co-authored by Claude
 *  6  Tue 03-03 12:00Z  Linus  renames src/a.ts to src/core.ts
 *  7  Wed 03-04 12:00Z  Linus  appends 1 line to src/core.ts
 *  8  Thu 03-05 12:00Z  Grace  appends 1 line to src/b.ts
 */
const commitUntilDependabot = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit(
      "2026-01-05T09:00:00Z",
      {
        "src/a.ts": lines("a", 10),
        "pnpm-lock.yaml": lines("lock", 100),
        ".mailmap": "Ada Lovelace <ada@example.com> <ada@old.example>\n",
      },
      { author: ada },
    );
    yield* repo.commit(
      "2026-01-06T10:00:00+02:00",
      { "src/a.ts": lines("a", 12) },
      { author: adaOldEmail },
    );
    yield* repo.commit(
      "2026-02-03T23:30:00-05:00",
      { "src/b.ts": lines("b", 5) },
      { author: grace },
    );
    yield* repo.commit(
      "2026-02-10T12:00:00Z",
      { "pnpm-lock.yaml": lines("lock", 140) },
      { author: dependabot },
    );
  });

const commitAfterDependabot = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit(
      "2026-03-02T12:00:00Z",
      { "src/b.ts": lines("b", 8) },
      {
        author: grace,
        message:
          "Extend b\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>",
      },
    );
    yield* repo.git("mv", "src/a.ts", "src/core.ts");
    yield* repo.commit("2026-03-03T12:00:00Z", {}, { author: linus });
    yield* repo.commit(
      "2026-03-04T12:00:00Z",
      { "src/core.ts": lines("a", 12) + "tail\n" },
      { author: linus },
    );
    yield* repo.commit(
      "2026-03-05T12:00:00Z",
      { "src/b.ts": lines("b", 9) },
      { author: grace },
    );
  });

const commitKnownHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* commitUntilDependabot(repo);
    yield* commitAfterDependabot(repo);
  });

layer(NodeServices.layer)("analyze a known history", (it) => {
  it.effect("reports the exact window and overview", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitKnownHistory(repo);

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(report.window, {
        since: "2026-01-05T09:00:00.000Z",
        until: "2026-03-10T00:00:00.000Z",
        commits: 8,
      });
      assert.deepStrictEqual(report.overview, {
        commits: 8,
        contributors: { total: 3, active30: 2, active90: 3, active365: 3 },
        files: 2,
        loc: 22,
        languages: [{ name: "TypeScript", files: 2, loc: 22 }],
      });
    }),
  );
});

layer(NodeServices.layer)("analyze automation", (it) => {
  it.effect("reports automation totals, months and tools", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitKnownHistory(repo);

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(report.automation, {
        totals: { human: 6, agentAssisted: 1, agent: 0, bot: 1 },
        months: [
          { month: "2026-01", human: 2, agentAssisted: 0, agent: 0, bot: 0 },
          { month: "2026-02", human: 1, agentAssisted: 0, agent: 0, bot: 1 },
          { month: "2026-03", human: 3, agentAssisted: 1, agent: 0, bot: 0 },
        ],
        tools: [
          { name: "Claude Code", kind: "agent", authored: 0, assisted: 1 },
          { name: "Dependabot", kind: "bot", authored: 1, assisted: 0 },
        ],
      });
    }),
  );

  it.effect(
    "orders contributors by commits, merges a mailmapped email, and counts code lines only",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitKnownHistory(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.strictEqual(report.totals.contributors, 3);
        assert.deepStrictEqual(
          report.contributors.map((c) => [c.name, c.email, c.commits, c.added]),
          [
            ["Grace", "grace@example.com", 3, 9],
            ["Ada Lovelace", "ada@example.com", 2, 12],
            ["Linus", "linus@example.com", 2, 1],
          ],
        );
        assert.deepStrictEqual(report.contributors[0], {
          name: "Grace",
          email: "grace@example.com",
          commits: 3,
          agentAssistedCommits: 1,
          activeDays: 3,
          added: 9,
          deleted: 0,
          firstCommitAt: "2026-02-04T04:30:00.000Z",
          lastCommitAt: "2026-03-05T12:00:00.000Z",
          active: true,
          areas: [{ path: "src", commits: 3 }],
        });
      }),
  );
});

layer(NodeServices.layer)("analyze weeks and punch card", (it) => {
  it.effect(
    "fills every week and month and counts the punch card in local time",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitKnownHistory(repo);

        const { activity, punchcard } = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          activity.weeks.map((week) => [
            week.commits,
            week.added,
            week.deleted,
          ]),
          [
            [2, 12, 0],
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [1, 5, 0],
            [1, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [4, 5, 0],
            [0, 0, 0],
          ],
        );
        assert.deepStrictEqual(
          activity.months.map((m) => [m.month, m.commits, m.contributors]),
          [
            ["2026-01", 2, 1],
            ["2026-02", 2, 1],
            ["2026-03", 4, 2],
          ],
        );
        // [weekday, hour, commits] of every non-empty cell; the Dependabot commit is not people's rhythm
        assert.deepStrictEqual(
          punchcard.flatMap((row, weekday) =>
            row.flatMap((count, hour) =>
              count > 0 ? [[weekday, hour, count]] : [],
            ),
          ),
          [
            [0, 9, 1],
            [0, 12, 1],
            [1, 10, 1],
            [1, 12, 1],
            [1, 23, 1],
            [2, 12, 1],
            [3, 12, 1],
          ],
        );
      }),
  );
});

layer(NodeServices.layer)("analyze since and scope", (it) => {
  it.effect(
    "narrows the activity sections to since but keeps the repository's first commit",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitKnownHistory(repo);

        const report = yield* analyze(
          analyzeOptionsFor(repo, { since: "30d" }),
        );

        assert.deepStrictEqual(report.window, {
          since: "2026-02-08T00:00:00.000Z",
          until: "2026-03-10T00:00:00.000Z",
          commits: 5,
        });
        assert.deepStrictEqual(report.automation.totals, {
          human: 3,
          agentAssisted: 1,
          agent: 0,
          bot: 1,
        });
        assert.deepStrictEqual(
          report.contributors.map((c) => [c.name, c.commits]),
          [
            ["Grace", 2],
            ["Linus", 2],
          ],
        );
        assert.strictEqual(
          report.repository.firstCommitAt,
          "2026-01-05T09:00:00.000Z",
        );
      }),
  );

  it.effect(
    "counts only commits under the scope, following a renamed file",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitKnownHistory(repo);

        const report = yield* analyze(
          analyzeOptionsFor(repo, { scope: "src/core.ts" }),
        );

        // the file was src/a.ts when Ada created and edited it
        assert.strictEqual(report.window.commits, 4);
        assert.strictEqual(report.repository.scope, "src/core.ts");
        assert.deepStrictEqual(
          report.contributors.map((c) => [c.name, c.commits, c.added]),
          [
            ["Ada Lovelace", 2, 12],
            ["Linus", 2, 1],
          ],
        );
      }),
  );
});

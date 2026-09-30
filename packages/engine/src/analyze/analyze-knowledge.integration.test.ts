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
const dependabot = {
  name: "dependabot[bot]",
  email: "49699333+dependabot[bot]@users.noreply.github.com",
};

const bundle = (directory: string, prefix: string, count: number) =>
  Object.fromEntries(
    ["x", "y", "z"].map((name) => [
      `${directory}/${name}.ts`,
      lines(prefix, count),
    ]),
  );

/**
 * Ada owns `src`; Grace creates `web`, and Ada (under an old email that
 * `.mailmap` merges into hers) extends every file of it; Dependabot edits
 * one web file last.
 *  1  01-05  Ada          adds src/{x,y,z}.ts and .mailmap
 *  2  02-01  Grace        adds web/{x,y,z}.ts
 *  3  02-10  Ada, old     appends to web/{x,y,z}.ts
 *  4  02-15  Dependabot   appends to web/x.ts
 */
const commitHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit(
      "2026-01-05T09:00:00Z",
      {
        ...bundle("src", "s", 20),
        ".mailmap": "Ada Lovelace <ada@example.com> <ada@old.example>\n",
      },
      { author: ada },
    );
    yield* repo.commit("2026-02-01T09:00:00Z", bundle("web", "w", 20), {
      author: grace,
    });
    yield* repo.commit("2026-02-10T09:00:00Z", bundle("web", "w", 40), {
      author: adaOldEmail,
    });
    yield* repo.commit(
      "2026-02-15T09:00:00Z",
      { "web/x.ts": lines("w", 40) + lines("bump", 60) },
      { author: dependabot },
    );
  });

layer(NodeServices.layer)("analyze knowledge", (it) => {
  it.effect(
    "names both people in the truck factor after .mailmap merges Ada's emails",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitHistory(repo);

        const { knowledge } = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(knowledge.truckFactor, {
          value: 2,
          people: [
            {
              name: "Ada Lovelace",
              email: "ada@example.com",
              active: true,
              lastCommitAt: "2026-02-10T09:00:00.000Z",
            },
            {
              name: "Grace",
              email: "grace@example.com",
              active: true,
              lastCommitAt: "2026-02-01T09:00:00.000Z",
            },
          ],
        });
        assert.strictEqual(knowledge.files, 6);
        assert.strictEqual(knowledge.withoutExpert, 0);
      }),
  );
});

layer(NodeServices.layer)("analyze knowledge directories", (it) => {
  it.effect(
    "reports src as Ada's island and web as shared, and counts the directories",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitHistory(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          report.knowledge.directories.map(
            ({ path, island, orphaned, truckFactor }) => [
              path,
              island,
              orphaned,
              truckFactor,
            ],
          ),
          [
            ["src", true, false, 1],
            ["web", false, false, 2],
          ],
        );
        assert.deepStrictEqual(
          report.knowledge.directories[1]?.experts.map(
            ({ email, files, soleFiles }) => [email, files, soleFiles],
          ),
          [
            ["ada@example.com", 3, 0],
            ["grace@example.com", 3, 0],
          ],
        );
        assert.strictEqual(report.totals.directories, 2);
      }),
  );
});

layer(NodeServices.layer)("analyze knowledge window and scope", (it) => {
  it.effect("ignores --since: knowledge covers the whole history", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitHistory(repo);

      const whole = yield* analyze(analyzeOptionsFor(repo));
      const recent = yield* analyze(
        analyzeOptionsFor(repo, { since: "2026-02-12" }),
      );

      assert.strictEqual(recent.window.commits, 1);
      assert.deepStrictEqual(recent.knowledge, whole.knowledge);
    }),
  );

  it.effect("limits knowledge to the scope's universe files", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitHistory(repo);

      const { knowledge } = yield* analyze(
        analyzeOptionsFor(repo, { scope: "src" }),
      );

      assert.strictEqual(knowledge.files, 3);
      assert.deepStrictEqual(
        knowledge.truckFactor.people.map(({ email }) => email),
        ["ada@example.com"],
      );
      assert.deepStrictEqual(knowledge.directories, []);
    }),
  );
});

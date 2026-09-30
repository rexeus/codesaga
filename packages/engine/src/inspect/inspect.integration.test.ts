import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { commitKnowledgeHistory, grace } from "../testing/knowledge-history.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { inspect } from "./inspect.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const adaExpert = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  active: true,
  lastCommitAt: "2026-02-10T09:00:00.000Z",
};
const graceExpert = {
  name: "Grace",
  email: "grace@example.com",
  active: true,
  lastCommitAt: "2026-02-01T09:00:00.000Z",
};

const srcXEntry = {
  pattern: "src/x.ts",
  files: 1,
  truckFactor: 1,
  island: true,
  orphaned: false,
  experts: [{ ...adaExpert, files: 1, soleFiles: 1, share: 1 }],
  commits: 1,
  lastCommitAt: "2026-01-05T09:00:00.000Z",
  automation: { human: 1, agentAssisted: 0, agent: 0, bot: 0 },
  reasons: ["Ada Lovelace is the only expert on 1 of 1 file"],
};

layer(NodeServices.layer)("inspect one argument", (it) => {
  it.effect("aggregates an exact file with its expert and window", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitKnowledgeHistory(repo);

      const result = yield* inspect({
        ...analyzeOptionsFor(repo),
        patterns: ["src/x.ts"],
      });

      assert.deepStrictEqual(result, {
        schemaVersion: 1,
        window: {
          since: "2026-01-05T09:00:00.000Z",
          until: "2026-03-10T00:00:00.000Z",
          commits: 4,
        },
        matches: [srcXEntry],
        unmatched: [],
      });
    }),
  );

  it.effect(
    "aggregates a directory over its files, with bot commits counted and never expert",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitKnowledgeHistory(repo);

        const { matches } = yield* inspect({
          ...analyzeOptionsFor(repo),
          patterns: ["web/"],
        });

        assert.deepStrictEqual(matches, [
          {
            pattern: "web/",
            files: 3,
            truckFactor: 2,
            island: false,
            orphaned: false,
            experts: [
              { ...adaExpert, files: 3, soleFiles: 0, share: 1 },
              { ...graceExpert, files: 3, soleFiles: 0, share: 1 },
            ],
            commits: 3,
            lastCommitAt: "2026-02-15T09:00:00.000Z",
            automation: { human: 2, agentAssisted: 0, agent: 0, bot: 1 },
            reasons: [],
          },
        ]);
      }),
  );
});

layer(NodeServices.layer)("inspect directories and globs", (it) => {
  it.effect("aggregates a glob that matches several files into one entry", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitKnowledgeHistory(repo);

      const { matches } = yield* inspect({
        ...analyzeOptionsFor(repo),
        patterns: ["*/x.ts"],
      });

      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches[0]?.files, 2);
      assert.deepStrictEqual(matches[0]?.experts, [
        { ...adaExpert, files: 2, soleFiles: 1, share: 1 },
        { ...graceExpert, files: 1, soleFiles: 0, share: 0.5 },
      ]);
    }),
  );
});

layer(NodeServices.layer)("inspect several arguments", (it) => {
  it.effect("lists a pattern without a universe file as unmatched", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitKnowledgeHistory(repo);

      const result = yield* inspect({
        ...analyzeOptionsFor(repo),
        patterns: ["src", "nope/**", ".mailmap"],
      });

      assert.deepStrictEqual(
        result.matches.map(({ pattern, files }) => [pattern, files]),
        [["src", 3]],
      );
      assert.deepStrictEqual(result.unmatched, ["nope/**", ".mailmap"]);
    }),
  );
});

layer(NodeServices.layer)("inspect the whole repository", (it) => {
  it.effect.each(["", ".", "./", "/"])(
    "treats %j as every universe file and keeps the argument as written",
    (pattern) =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitKnowledgeHistory(repo);

        const result = yield* inspect({
          ...analyzeOptionsFor(repo),
          patterns: [pattern],
        });

        assert.deepStrictEqual(result.unmatched, []);
        assert.deepStrictEqual(
          result.matches.map((entry) => [entry.pattern, entry.files]),
          [[pattern, 6]],
        );
      }),
  );
});

layer(NodeServices.layer)("inspect window and agents", (it) => {
  it.effect("narrows commits and automation to --since, not expertise", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitKnowledgeHistory(repo);

      const { matches } = yield* inspect({
        ...analyzeOptionsFor(repo, { since: "2026-02-12" }),
        patterns: ["web"],
      });

      assert.strictEqual(matches[0]?.commits, 1);
      assert.deepStrictEqual(matches[0]?.automation, {
        human: 0,
        agentAssisted: 0,
        agent: 0,
        bot: 1,
      });
      assert.strictEqual(matches[0]?.experts.length, 2);
    }),
  );

  it.effect("names the agent behind co-authored commits in the reasons", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitKnowledgeHistory(repo);
      yield* repo.commit(
        "2026-02-20T09:00:00Z",
        { "src/y.ts": "changed\n" },
        {
          author: grace,
          message:
            "Tweak y\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>",
        },
      );

      const { matches } = yield* inspect({
        ...analyzeOptionsFor(repo),
        patterns: ["src/y.ts"],
      });

      assert.strictEqual(matches[0]?.automation.agentAssisted, 1);
      assert.deepStrictEqual(matches[0]?.reasons, [
        "50% of 2 commits in the window were co-authored by Claude Code",
      ]);
    }),
  );
});

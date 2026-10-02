import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import type { Report } from "../report/report.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { commitKnowledgeHistory } from "../testing/knowledge-history.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

layer(NodeServices.layer)("analyze knowledge", (it) => {
  it.effect(
    "names both people in the truck factor after .mailmap merges Ada's emails",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitKnowledgeHistory(repo);

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
        yield* commitKnowledgeHistory(repo);

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

type TerritoryNode = Report["knowledge"]["territories"]["territories"][number];

const withoutFocusBadge = (territory: TerritoryNode): TerritoryNode => ({
  ...territory,
  badges: territory.badges.filter(({ kind }) => kind !== "in-focus"),
  territories: territory.territories.map((child) => withoutFocusBadge(child)),
});

/** `in-focus` reads the window by definition; everything else in knowledge does not. */
const withoutFocus = (section: Report["knowledge"]) => ({
  ...section,
  territories: {
    ...section.territories,
    territories: section.territories.territories.map((territory) =>
      withoutFocusBadge(territory),
    ),
  },
});

layer(NodeServices.layer)("analyze knowledge window and scope", (it) => {
  it.effect("ignores --since: knowledge covers the whole history", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitKnowledgeHistory(repo);

      const whole = yield* analyze(analyzeOptionsFor(repo));
      const recent = yield* analyze(
        analyzeOptionsFor(repo, { since: "2026-02-12" }),
      );

      assert.strictEqual(recent.window.commits, 1);
      assert.deepStrictEqual(
        withoutFocus(recent.knowledge),
        withoutFocus(whole.knowledge),
      );
    }),
  );

  it.effect("limits knowledge to the scope's universe files", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitKnowledgeHistory(repo);

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

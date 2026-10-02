import { describe, expect, it } from "vitest";

import { at, classifiedCommit } from "../testing/classified-commit.js";
import { storyFacts } from "../testing/story-facts.js";
import { knowledgeStories } from "./knowledge-facts.js";
import type { StoryTerritory } from "./stories.js";

const ada = { name: "Ada", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };

const territory = (
  overrides: Partial<StoryTerritory> = {},
): StoryTerritory => ({
  path: "packages/db",
  kind: "package",
  paths: ["packages/db/a.ts", "packages/db/b.ts", "packages/db/c.ts"],
  orphaned: false,
  withoutActiveExpert: 0,
  lastChangeTime: undefined,
  ...overrides,
});

const alone = {
  value: 1,
  people: [{ ...ada, active: true, lastCommitAt: "2026-06-30T00:00:00.000Z" }],
};
const runAlert = (
  truckFactor: typeof alone,
  authors: ReadonlyArray<typeof ada>,
) =>
  knowledgeStories(
    storyFacts({
      commits: authors.map((author) => classifiedCommit({ author })),
      knowledge: { files: 40, truckFactor },
    }),
  );

describe("knowledgeStories truck-factor alert", () => {
  it("alerts when the truck factor is 1 and more than one person contributed", () => {
    expect(runAlert(alone, [ada, grace])).toStrictEqual([
      {
        kind: "truck-factor-alert",
        title: "Truck factor 1",
        detail:
          "If Ada left, more than half of the 40 files would have no expert.",
        value: 1,
        people: [ada],
      },
    ]);
  });

  it("does not alert for a solo project", () => {
    expect(runAlert(alone, [ada, ada])).toStrictEqual([]);
  });

  it("does not alert at a truck factor of 2", () => {
    expect(
      runAlert({ value: 2, people: [...alone.people, ...alone.people] }, [
        ada,
        grace,
      ]),
    ).toStrictEqual([]);
  });

  it("does not count a bot as a second contributor", () => {
    const withBot = knowledgeStories(
      storyFacts({
        commits: [
          classifiedCommit({ author: ada }),
          classifiedCommit({
            author: grace,
            class: "bot",
            tools: ["Dependabot"],
          }),
        ],
        knowledge: { files: 40, truckFactor: alone },
      }),
    );

    expect(withBot).toStrictEqual([]);
  });
});

const runOrphaned = (territories: ReadonlyArray<StoryTerritory>) =>
  knowledgeStories(storyFacts({ territories }));

describe("knowledgeStories orphaned knowledge", () => {
  it("reports the largest orphaned territory", () => {
    const small = territory({
      path: "packages/small",
      orphaned: true,
      withoutActiveExpert: 2,
    });
    const large = territory({
      orphaned: true,
      withoutActiveExpert: 30,
      paths: Array.from({ length: 52 }, (_, i) => `packages/db/${i}.ts`),
    });

    expect(runOrphaned([small, large])).toStrictEqual([
      {
        kind: "orphaned-knowledge",
        title: "Orphaned knowledge",
        detail: "30 of 52 files in packages/db have no active expert.",
        value: 30,
        path: "packages/db",
      },
    ]);
  });

  it("calls the root territory the repository root", () => {
    const root = territory({
      path: ".",
      orphaned: true,
      withoutActiveExpert: 2,
    });

    expect(runOrphaned([root])).toMatchObject([
      {
        detail: "2 of 3 files in the repository root have no active expert.",
        path: ".",
      },
    ]);
  });

  it("reports nothing when no territory is orphaned, and never names an other-files territory", () => {
    expect(runOrphaned([territory()])).toStrictEqual([]);
    expect(
      runOrphaned([territory({ kind: "other", orphaned: true })]),
    ).toStrictEqual([]);
  });

  it("reports nothing without territories", () => {
    expect(knowledgeStories(storyFacts())).toStrictEqual([]);
  });
});

// now is 2026-07-01: 6 calendar months back is 2026-01-01
const runQuiet = (lastChange: string, territories = [territory()]) =>
  knowledgeStories(
    storyFacts({
      territories: territories.map((each) => ({
        ...each,
        lastChangeTime: each.lastChangeTime ?? at(lastChange),
      })),
    }),
  );

describe("knowledgeStories quiet territory", () => {
  it("reports a territory untouched for 6 months", () => {
    expect(runQuiet("2026-01-01T00:00:00Z")).toStrictEqual([
      {
        kind: "quiet-territory",
        title: "Quiet corner",
        detail: "packages/db has not changed since 2026-01-01.",
        value: 6,
        date: "2026-01-01",
        path: "packages/db",
      },
    ]);
  });

  it("starts the sentence with the repository root for the root territory", () => {
    expect(
      runQuiet("2026-01-01T00:00:00Z", [territory({ path: "." })]),
    ).toMatchObject([
      {
        detail: "The repository root has not changed since 2026-01-01.",
        path: ".",
      },
    ]);
  });

  it("reports no quiet territory when it changed within 6 months", () => {
    expect(runQuiet("2026-01-01T00:00:01Z")).toStrictEqual([]);
  });

  it("reports the territory untouched longest, and skips other-files territories and territories without a known change", () => {
    const changed = (
      path: string,
      time: string,
      kind: StoryTerritory["kind"] = "package",
    ) => territory({ path, kind, lastChangeTime: at(time) });
    const found = knowledgeStories(
      storyFacts({
        territories: [
          changed("packages/db", "2025-09-01T00:00:00Z"),
          changed("packages/ui", "2025-03-01T00:00:00Z"),
          changed("packages/old", "2020-01-01T00:00:00Z", "other"),
          territory({ path: "packages/unknown" }),
        ],
      }),
    );

    expect(found).toMatchObject([
      { path: "packages/ui", value: 16, date: "2025-03-01" },
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { at, classifiedCommit } from "../testing/classified-commit.js";
import { highlightFacts } from "../testing/highlight-facts.js";
import type { HighlightArea } from "./highlights.js";
import { knowledgeHighlights } from "./knowledge-facts.js";

const ada = { name: "Ada", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };

const area = (overrides: Partial<HighlightArea> = {}): HighlightArea => ({
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
  knowledgeHighlights(
    highlightFacts({
      commits: authors.map((author) => classifiedCommit({ author })),
      knowledge: { files: 40, truckFactor },
    }),
  );

describe("knowledgeHighlights truck-factor alert", () => {
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
    const withBot = knowledgeHighlights(
      highlightFacts({
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

const runOrphaned = (areas: ReadonlyArray<HighlightArea>) =>
  knowledgeHighlights(highlightFacts({ areas }));

describe("knowledgeHighlights orphaned knowledge", () => {
  it("reports the largest orphaned area", () => {
    const small = area({
      path: "packages/small",
      orphaned: true,
      withoutActiveExpert: 2,
    });
    const large = area({
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

  it("reports nothing when no area is orphaned, and never names a rest area", () => {
    expect(runOrphaned([area()])).toStrictEqual([]);
    expect(runOrphaned([area({ kind: "rest", orphaned: true })])).toStrictEqual(
      [],
    );
  });

  it("reports nothing without areas", () => {
    expect(knowledgeHighlights(highlightFacts())).toStrictEqual([]);
  });
});

// now is 2026-07-01: 6 calendar months back is 2026-01-01
const runQuiet = (lastChange: string, areas = [area()]) =>
  knowledgeHighlights(
    highlightFacts({
      areas: areas.map((each) => ({
        ...each,
        lastChangeTime: each.lastChangeTime ?? at(lastChange),
      })),
    }),
  );

describe("knowledgeHighlights quiet area", () => {
  it("reports an area untouched for 6 months", () => {
    expect(runQuiet("2026-01-01T00:00:00Z")).toStrictEqual([
      {
        kind: "quiet-area",
        title: "Quiet corner",
        detail: "packages/db has not changed since 2026-01-01.",
        value: 6,
        date: "2026-01-01",
        path: "packages/db",
      },
    ]);
  });

  it("reports no quiet area when it changed within 6 months", () => {
    expect(runQuiet("2026-01-01T00:00:01Z")).toStrictEqual([]);
  });

  it("reports the area untouched longest, and skips rest areas and areas without a known change", () => {
    const changed = (
      path: string,
      time: string,
      kind: HighlightArea["kind"] = "package",
    ) => area({ path, kind, lastChangeTime: at(time) });
    const found = knowledgeHighlights(
      highlightFacts({
        areas: [
          changed("packages/db", "2025-09-01T00:00:00Z"),
          changed("packages/ui", "2025-03-01T00:00:00Z"),
          changed("packages/old", "2020-01-01T00:00:00Z", "rest"),
          area({ path: "packages/unknown" }),
        ],
      }),
    );

    expect(found).toMatchObject([
      { path: "packages/ui", value: 16, date: "2025-03-01" },
    ]);
  });
});

import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import {
  daysAgo,
  expert,
  quietTerritory,
} from "../testing/territory-badge-input.js";
import type { TerritoryBadgeInput } from "./territory-badge-facts.js";
import { territoryBadges } from "./territory-badges.js";

const now = DateTime.makeUnsafe("2026-07-01T00:00:00Z");

const kindsOf = (overrides: Partial<TerritoryBadgeInput>) =>
  territoryBadges(quietTerritory(overrides), now).map(({ kind }) => kind);

/** A first commit by a newcomer that touched `path`, `days` ago. */
const firstCommit = (days: number, path = "packages/a/src/f0.ts") => ({
  time: daysAgo(days),
  paths: [path],
});

const withTests = (tests: number) =>
  Array.from({ length: 10 }, (_, i) =>
    i < tests ? `packages/a/src/f${i}.test.ts` : `packages/a/src/f${i}.ts`,
  );

const evidenceOf = (experts: TerritoryBadgeInput["experts"]) =>
  territoryBadges(quietTerritory({ experts }), now)[0]?.evidence;

/** An active main expert who first committed to the territory `days` ago. */
const recentMain = (days: number) => expert({ firstTime: daysAgo(days) });

/** An expert who left more than 183 days ago, the previous main expert. */
const dormantPredecessor = expert({
  firstTime: daysAgo(1500),
  lastTime: daysAgo(400),
});

/** Each badge is present at its threshold and absent just below it. */
const cases: ReadonlyArray<
  readonly [string, Partial<TerritoryBadgeInput>, Partial<TerritoryBadgeInput>]
> = [
  ["island", { island: true }, { island: false }],
  ["orphaned", { orphaned: true }, { orphaned: false }],
  [
    "one-expert",
    { experts: [expert(), expert({ lastTime: daysAgo(400) })] },
    {},
  ],
  [
    "shared-knowledge",
    { experts: [expert(), expert(), expert(), expert()], truckFactor: 4 },
    { experts: [expert(), expert(), expert()], truckFactor: 4 },
  ],
  [
    "knowledge-fading",
    { experts: [expert({ lastTime: daysAgo(90) }), expert()] },
    { experts: [expert({ lastTime: daysAgo(89) }), expert()] },
  ],
  [
    "handover",
    { experts: [recentMain(180), dormantPredecessor] },
    { experts: [recentMain(181), dormantPredecessor] },
  ],
  [
    "new-territory",
    {
      startTime: daysAgo(270),
      fileFirstCommits: [daysAgo(90), daysAgo(10)],
    },
    {
      startTime: daysAgo(270),
      fileFirstCommits: [daysAgo(91), daysAgo(10)],
    },
  ],
  [
    "in-focus",
    { recentCommits: 6, peerRecentCommits: 5 },
    { recentCommits: 5, peerRecentCommits: 5 },
  ],
  ["quiet", { lastChangeTime: daysAgo(183) }, { lastChangeTime: daysAgo(182) }],
  [
    "newcomer-friendly",
    { firstCommits: [firstCommit(180), firstCommit(5)] },
    { firstCommits: [firstCommit(181), firstCommit(5)] },
  ],
  ["well-tested", { paths: withTests(4) }, { paths: withTests(3) }],
];

describe("territoryBadges", () => {
  it("awards no badge to a territory with nothing to say", () => {
    expect(kindsOf({})).toStrictEqual([]);
  });

  it.each(cases)(
    "awards %s at its threshold and withholds it just below",
    (kind, atThreshold, below) => {
      expect(kindsOf(atThreshold)).toContain(kind);
      expect(kindsOf(below)).not.toContain(kind);
    },
  );

  it("withholds knowledge fading once the main expert is silent for more than 183 days", () => {
    expect(
      kindsOf({ experts: [expert({ lastTime: daysAgo(183) })] }),
    ).toContain("knowledge-fading");
    expect(
      kindsOf({ experts: [expert({ lastTime: daysAgo(184) })] }),
    ).not.toContain("knowledge-fading");
  });

  it("awards handover only to a recent replacement of a dormant main expert", () => {
    const longGone = { ...dormantPredecessor, lastTime: daysAgo(184) };
    const stillHere = { ...dormantPredecessor, lastTime: daysAgo(183) };

    // the main expert has been around for years, or nobody left, or the main expert left
    expect(
      kindsOf({ experts: [recentMain(500), dormantPredecessor] }),
    ).not.toContain("handover");
    expect(kindsOf({ experts: [recentMain(10), stillHere] })).not.toContain(
      "handover",
    );
    expect(kindsOf({ experts: [recentMain(10), longGone] })).toContain(
      "handover",
    );
    expect(
      kindsOf({
        experts: [
          { ...recentMain(10), lastTime: daysAgo(400) },
          dormantPredecessor,
        ],
      }),
    ).not.toContain("handover");
  });
});

describe("territoryBadges rules in detail", () => {
  it("does not call a territory new when the repository is not 180 days older", () => {
    const created = { fileFirstCommits: [daysAgo(10)] };

    expect(kindsOf({ ...created, startTime: daysAgo(190) })).toContain(
      "new-territory",
    );
    expect(kindsOf({ ...created, startTime: daysAgo(189) })).not.toContain(
      "new-territory",
    );
  });

  it("awards shared knowledge only with both four active experts and a truck factor of four", () => {
    const four = [expert(), expert(), expert(), expert()];

    expect(kindsOf({ experts: four, truckFactor: 3 })).not.toContain(
      "shared-knowledge",
    );
    expect(
      kindsOf({
        experts: [...four.slice(0, 3), expert({ lastTime: daysAgo(400) })],
        truckFactor: 4,
      }),
    ).not.toContain("shared-knowledge");
  });

  it("does not call a territory new, or newcomer-friendly, without a known repository start", () => {
    const young = {
      fileFirstCommits: [daysAgo(10)],
      firstCommits: [firstCommit(180), firstCommit(5)],
    };

    expect(kindsOf({ ...young, startTime: daysAgo(190) })).toEqual(
      expect.arrayContaining(["new-territory", "newcomer-friendly"]),
    );
    expect(kindsOf({ ...young, startTime: undefined })).not.toContain(
      "new-territory",
    );
  });

  it("awards no single expert to an island", () => {
    expect(
      kindsOf({ island: true, experts: [expert({ soleFiles: 9 })] }),
    ).not.toContain("one-expert");
  });

  it("counts only first commits that touch the territory and fall in the last 180 days", () => {
    const elsewhere = firstCommit(5, "packages/b/src/x.ts");

    expect(
      kindsOf({ firstCommits: [firstCommit(5), elsewhere] }),
    ).not.toContain("newcomer-friendly");
  });
});

describe("territoryBadges well tested", () => {
  it.each([
    "packages/a/test",
    "tests/fixtures",
    "src/__tests__",
    "spec",
    "packages/a/src/__mocks__",
    "src/test-utils",
  ])("is not awarded to the test territory %s", (path) => {
    expect(kindsOf({ path, paths: withTests(10) })).not.toContain(
      "well-tested",
    );
  });

  it.each([".", "packages/contesting", "packages/testing", "src/fixtures"])(
    "is awarded to %s, which is no test directory",
    (path) => {
      expect(kindsOf({ path, paths: withTests(10) })).toContain("well-tested");
    },
  );
});

describe("territoryBadges evidence and order", () => {
  it("states each rule with the numbers behind it", () => {
    const badges = territoryBadges(
      quietTerritory({
        island: true,
        experts: [expert({ soleFiles: 9 })],
        paths: withTests(4),
      }),
      now,
    );

    expect(badges).toStrictEqual([
      {
        kind: "island",
        category: "knowledge",
        label: "Knowledge island",
        evidence: "One person is sole expert on 9 of 10 files.",
      },
      {
        kind: "well-tested",
        category: "code",
        label: "Well tested",
        evidence: "4 of 10 files (40%) are tests.",
      },
    ]);
  });

  it("words the single expert for one expert and for several", () => {
    expect(evidenceOf([expert()])).toBe(
      "The territory's only expert is active.",
    );
    expect(evidenceOf([expert(), expert({ lastTime: daysAgo(400) })])).toBe(
      "Only 1 of 2 experts is active.",
    );
  });

  it("orders the badges by priority", () => {
    expect(
      kindsOf({
        paths: withTests(5),
        island: true,
        orphaned: true,
        lastChangeTime: daysAgo(400),
        fileFirstCommits: [daysAgo(5)],
      }),
    ).toStrictEqual([
      "island",
      "orphaned",
      "new-territory",
      "quiet",
      "well-tested",
    ]);
  });

  it("awards no badge to an other-files territory", () => {
    expect(
      kindsOf({ kind: "other", island: true, orphaned: true }),
    ).toStrictEqual([]);
  });
});

describe("territoryBadges categories", () => {
  it("files each badge under knowledge, activity or code", () => {
    const badges = territoryBadges(
      quietTerritory({
        paths: withTests(5),
        island: true,
        orphaned: true,
        lastChangeTime: daysAgo(400),
        fileFirstCommits: [daysAgo(5)],
      }),
      now,
    );

    expect(badges.map(({ kind, category }) => [kind, category])).toStrictEqual([
      ["island", "knowledge"],
      ["orphaned", "knowledge"],
      ["new-territory", "activity"],
      ["quiet", "activity"],
      ["well-tested", "code"],
    ]);
  });
});

describe("territoryBadges on a huge territory", () => {
  it("judges the creation of a territory with hundreds of thousands of files", () => {
    const files = Array.from({ length: 300_000 }, (_, i) =>
      daysAgo(10 + (i % 60)),
    );

    expect(
      kindsOf({ fileFirstCommits: files, startTime: daysAgo(1_000_000) }),
    ).toContain("new-territory");
  });
});

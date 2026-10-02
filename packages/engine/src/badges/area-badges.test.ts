import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import { at } from "../testing/classified-commit.js";
import { areaBadges } from "./area-badges.js";
import type { AreaBadgeInput } from "./area-badges.js";

const now = DateTime.makeUnsafe("2026-07-01T00:00:00Z");
const nowSeconds = at("2026-07-01T00:00:00Z");

const daysAgo = (days: number): number => nowSeconds - days * 86_400;

const expert = (
  overrides: Partial<AreaBadgeInput["experts"][number]> = {},
) => ({
  files: 5,
  soleFiles: 0,
  firstTime: daysAgo(2000),
  lastTime: daysAgo(1),
  ...overrides,
});

/** An area that earns no badge: ten source files, two active experts, old, changed yesterday. */
const quietArea = (
  overrides: Partial<AreaBadgeInput> = {},
): AreaBadgeInput => ({
  kind: "package",
  paths: Array.from({ length: 10 }, (_, i) => `packages/a/src/f${i}.ts`),
  truckFactor: 2,
  island: false,
  orphaned: false,
  experts: [expert(), expert()],
  fileFirstCommits: [daysAgo(2000), daysAgo(1500)],
  lastChangeTime: daysAgo(1),
  commitsInWindow: 0,
  peerCommitsInWindow: 0,
  startTime: 0,
  firstCommits: [],
  ...overrides,
});

const kindsOf = (overrides: Partial<AreaBadgeInput>) =>
  areaBadges(quietArea(overrides), now).map(({ kind }) => kind);

/** A first commit by a newcomer that touched `path`, `days` ago. */
const firstCommit = (days: number, path = "packages/a/src/f0.ts") => ({
  time: daysAgo(days),
  paths: [path],
});

const withTests = (tests: number) =>
  Array.from({ length: 10 }, (_, i) =>
    i < tests ? `packages/a/src/f${i}.test.ts` : `packages/a/src/f${i}.ts`,
  );

const evidenceOf = (experts: AreaBadgeInput["experts"]) =>
  areaBadges(quietArea({ experts }), now)[0]?.evidence;

/** An active main expert who first committed to the area `days` ago. */
const recentMain = (days: number) => expert({ firstTime: daysAgo(days) });

/** An expert who left more than 183 days ago, the previous main expert. */
const dormantPredecessor = expert({
  firstTime: daysAgo(1500),
  lastTime: daysAgo(400),
});

/** Each badge is present at its threshold and absent just below it. */
const cases: ReadonlyArray<
  readonly [string, Partial<AreaBadgeInput>, Partial<AreaBadgeInput>]
> = [
  ["island", { island: true }, { island: false }],
  ["orphaned", { orphaned: true }, { orphaned: false }],
  [
    "single-expert",
    { experts: [expert(), expert({ lastTime: daysAgo(400) })] },
    {},
  ],
  [
    "shared-knowledge",
    { experts: [expert(), expert(), expert()], truckFactor: 3 },
    { experts: [expert(), expert()], truckFactor: 3 },
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
    "new",
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
    { commitsInWindow: 6, peerCommitsInWindow: 5 },
    { commitsInWindow: 5, peerCommitsInWindow: 5 },
  ],
  ["quiet", { lastChangeTime: daysAgo(183) }, { lastChangeTime: daysAgo(182) }],
  [
    "newcomer-friendly",
    { firstCommits: [firstCommit(180), firstCommit(5)] },
    { firstCommits: [firstCommit(181), firstCommit(5)] },
  ],
  ["well-tested", { paths: withTests(4) }, { paths: withTests(3) }],
];

describe("areaBadges", () => {
  it("awards no badge to an area with nothing to say", () => {
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

  it("does not call an area new when the repository is not 180 days older", () => {
    const created = { fileFirstCommits: [daysAgo(10)] };

    expect(kindsOf({ ...created, startTime: daysAgo(190) })).toContain("new");
    expect(kindsOf({ ...created, startTime: daysAgo(189) })).not.toContain(
      "new",
    );
  });

  it("awards no single expert to an island", () => {
    expect(
      kindsOf({ island: true, experts: [expert({ soleFiles: 9 })] }),
    ).not.toContain("single-expert");
  });

  it("counts only first commits that touch the area and fall in the last 180 days", () => {
    const elsewhere = firstCommit(5, "packages/b/src/x.ts");

    expect(
      kindsOf({ firstCommits: [firstCommit(5), elsewhere] }),
    ).not.toContain("newcomer-friendly");
  });
});

describe("areaBadges evidence and order", () => {
  it("states each rule with the numbers behind it", () => {
    const badges = areaBadges(
      quietArea({
        island: true,
        experts: [expert({ soleFiles: 9 })],
        paths: withTests(4),
      }),
      now,
    );

    expect(badges).toStrictEqual([
      {
        kind: "island",
        label: "Knowledge island",
        evidence: "One person is sole expert on 9 of 10 files.",
      },
      {
        kind: "well-tested",
        label: "Well tested",
        evidence: "4 of 10 files (40%) are tests.",
      },
    ]);
  });

  it("words the single expert for one expert and for several", () => {
    expect(evidenceOf([expert()])).toBe("The area's only expert is active.");
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
    ).toStrictEqual(["island", "orphaned", "new", "quiet", "well-tested"]);
  });

  it("awards no badge to a rest area", () => {
    expect(
      kindsOf({ kind: "rest", island: true, orphaned: true }),
    ).toStrictEqual([]);
  });
});

describe("areaBadges on a huge area", () => {
  it("judges the creation of an area with hundreds of thousands of files", () => {
    const files = Array.from({ length: 300_000 }, (_, i) =>
      daysAgo(10 + (i % 60)),
    );

    expect(
      kindsOf({ fileFirstCommits: files, startTime: daysAgo(1_000_000) }),
    ).toContain("new");
  });
});

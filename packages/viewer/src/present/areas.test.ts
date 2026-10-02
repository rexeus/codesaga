import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import {
  areaViews,
  depthTicks,
  inactiveLegend,
  levelStatus,
  levelSummary,
  recommendationHeadline,
  recommendedLevel,
  sliderFill,
  startLevel,
} from "./areas.js";

type Areas = Report["knowledge"]["areas"];
type Area = Areas["levels"][number]["areas"][number];

const [maya, tomas, priya] = sampleReport().contributors;

const expert = (name: string, files: number, share: number, active = true) => ({
  name,
  email:
    { Ann: maya?.email, Bo: tomas?.email, Cy: priya?.email }[name] ??
    `${name.toLowerCase()}@x.dev`,
  active,
  lastCommitAt: "2026-09-01T00:00:00.000Z",
  files,
  soleFiles: 0,
  share,
});

const area = (overrides: Partial<Area>): Area => ({
  path: "packages/db",
  files: 20,
  truckFactor: 3,
  island: false,
  orphaned: false,
  experts: [],
  reasons: [],
  kind: "package",
  lastChangedAt: "2026-08-14T08:00:00.000Z",
  badges: [],
  ...overrides,
});

const level = (depth: number, areas: Area[], totalAreas = areas.length) => ({
  depth,
  totalAreas,
  areas,
});

const NOW = "2026-10-02T09:00:00.000Z";

/** The sample report with 100 universe files, dated `NOW`; `solo` leaves one contributor. */
const reportOf = (solo = false): Report => {
  const report = sampleReport();
  return {
    ...report,
    generatedAt: NOW,
    knowledge: { ...report.knowledge, files: 100 },
    overview: {
      ...report.overview,
      contributors: { ...report.overview.contributors, total: solo ? 1 : 8 },
    },
  };
};

describe("areaViews", () => {
  const [card, loose, root] = areaViews(
    level(1, [
      area({
        experts: [
          expert("Ann", 12, 0.6),
          expert("Bo", 5, 0.25, false),
          expert("Cy", 2, 0.1),
          expert("Di", 1, 0.05),
        ],
      }),
      area({ path: "src", kind: "rest", files: 5, truckFactor: 1 }),
      area({ path: ".", files: 10, truckFactor: 2 }),
    ]),
    reportOf(),
  );

  it("says when the area last changed, relative to the report's date", () => {
    // 14 Aug to 2 Oct 2026 is 49 days
    expect(card?.changed).toBe("7 weeks ago");
  });

  it("splits a path into a dimmed parent and the area's own name", () => {
    expect([card?.parent, card?.leaf]).toEqual(["packages/", "db/"]);
    expect([root?.parent, root?.leaf]).toEqual(["", "/ (root)"]);
  });

  it("marks the grouped small areas as loose files", () => {
    expect([card?.loose, loose?.loose]).toEqual([false, true]);
  });

  it("shares the files of the area out of all files, and sizes it against the biggest area", () => {
    expect([card?.share, loose?.share, card?.sizeFraction]).toEqual([
      "20%",
      "5%",
      1,
    ]);
  });

  it("writes a handful of files out of thousands as under one percent, not zero", () => {
    const report = reportOf();
    const [few] = areaViews(level(1, [area({ files: 1 })]), {
      ...report,
      knowledge: { ...report.knowledge, files: 435 },
    });

    expect(few?.share).toBe("<1%");
  });

  it("grades the truck factor: 1 critical, 2 a warning, more nothing", () => {
    expect([card?.risk, loose?.risk, root?.risk]).toEqual([
      "none",
      "crit",
      "warn",
    ]);
  });
});

describe("the experts of a card", () => {
  const [card, loose] = areaViews(
    level(1, [
      area({
        experts: [
          expert("Ann", 12, 0.6),
          expert("Bo", 5, 0.25, false),
          expert("Cy", 2, 0.1),
          expert("Di", 1, 0.05),
        ],
      }),
      area({ path: "src", kind: "rest", files: 5 }),
    ]),
    reportOf(),
  );

  it("colors known contributors by their slot and everyone else neutral", () => {
    expect(card?.segments.map(({ entity }) => entity)).toEqual([
      "slot-1",
      "slot-2",
      "slot-3",
      "slot-other",
    ]);
  });

  it("lists the three biggest experts, flags the inactive and counts the rest", () => {
    expect(
      card?.experts.map(({ name, share, active }) => [name, share, active]),
    ).toEqual([
      ["Ann", "60%", true],
      ["Bo", "25%", false],
      ["Cy", "10%", true],
    ]);
    expect(card?.moreExperts).toBe(1);
  });

  it("leaves the bar weight no expert holds as unclaimed", () => {
    // 12 + 5 + 2 + 1 of 20 files
    expect(card?.unclaimed).toBe(0);
    expect(loose?.unclaimed).toBe(5);
  });
});

const badge = (kind: "island" | "well-tested" | "single-expert" | "quiet") => ({
  kind,
  label: kind,
  evidence: "because",
});

describe("the badges of a solo repository", () => {
  const withBadges = area({
    badges: [
      badge("island"),
      badge("single-expert"),
      badge("well-tested"),
      badge("quiet"),
    ],
  });

  it("keeps only the badges that do not rest on several people", () => {
    const [solo] = areaViews(level(1, [withBadges]), reportOf(true));

    expect(solo?.badges.chips.map(({ label }) => label)).toEqual([
      "well-tested",
      "quiet",
    ]);
  });

  it("keeps every badge with a team", () => {
    const [team] = areaViews(level(1, [withBadges]), reportOf());

    expect(team?.badges.chips).toHaveLength(3);
    expect(team?.badges.more?.count).toBe(1);
  });
});

describe("the line owners of a card", () => {
  const owners = {
    lines: 1000,
    skippedFiles: 0,
    owners: [
      { name: "Ann", email: "a@x.dev", lines: 700, share: 0.7, kind: "human" },
      { name: "Bot", email: "b@x.dev", lines: 200, share: 0.2, kind: "bot" },
      { name: "Cy", email: "c@x.dev", lines: 50, share: 0.05, kind: "human" },
      { name: "Di", email: "d@x.dev", lines: 30, share: 0.03, kind: "human" },
    ],
  } as const;

  it("lists the three authors of the most lines, bots named as such, when blame ran", () => {
    const [card] = areaViews(
      level(1, [area({ lineOwners: owners })]),
      reportOf(),
    );

    expect(card?.lineOwners).toEqual([
      { name: "Ann", share: "70%", kind: "human" },
      { name: "Bot", share: "20%", kind: "bot" },
      { name: "Cy", share: "5%", kind: "human" },
    ]);
  });

  it("has none without blame", () => {
    const [card] = areaViews(level(1, [area({})]), reportOf());

    expect(card?.lineOwners).toBeNull();
  });
});

describe("levelSummary", () => {
  it("counts the areas, their files and the risky ones", () => {
    const summary = levelSummary(
      level(1, [
        area({ files: 30, truckFactor: 1, island: true }),
        area({ files: 20, truckFactor: 2, orphaned: true }),
        area({ files: 10, truckFactor: 5 }),
      ]),
      80,
    );

    expect(summary).toEqual({
      areas: 3,
      looseGroups: 0,
      coveredFiles: 60,
      totalFiles: 80,
      lowTruckFactor: 2,
      islands: 1,
      orphaned: 1,
      truncated: null,
    });
  });

  it("counts areas without the groups of loose files, as the engine's recommendation does", () => {
    const levelWithLoose = level(1, [
      area({ files: 30 }),
      area({ path: "src", kind: "directory", files: 20 }),
      area({ path: "src", kind: "rest", files: 4 }),
    ]);

    expect(levelSummary(levelWithLoose, 80)).toMatchObject({
      areas: 2,
      looseGroups: 1,
    });
    expect(levelStatus(levelWithLoose)).toBe("2 non-overlapping areas");
    expect(
      depthTicks({
        depth: 1,
        recommendedDepth: 1,
        reason: "level 1: 2 areas with 3+ files for 3 active contributors",
        levels: [levelWithLoose],
      })[0]?.count,
    ).toBe("2 areas");
  });

  it("says so when the report's limit cut areas off", () => {
    const summary = levelSummary(level(1, [area({})], 40), 80);

    expect(summary.truncated).toBe(
      "Showing the 1 riskiest of 40 areas: the report was limited.",
    );
  });
});

describe("the depth slider", () => {
  const areas: Areas = {
    depth: 3,
    recommendedDepth: 2,
    reason: "level 2: 11 areas for 7 active contributors",
    levels: [
      level(1, [], 5),
      level(2, [], 11),
      level(3, [], 16),
      level(4, [], 1),
    ],
  };

  it("has a stop per level, evenly spread, with the recommended one marked", () => {
    expect(
      depthTicks(areas).map(({ label, count, position, recommended }) => [
        label,
        count,
        position,
        recommended,
      ]),
    ).toEqual([
      ["Level 1", "5 areas", 0, false],
      ["Level 2", "11 areas", 1 / 3, true],
      ["Level 3", "16 areas", 2 / 3, false],
      ["Level 4", "1 area", 1, false],
    ]);
  });

  it("starts at the report's depth and jumps to the recommended level", () => {
    expect(startLevel(areas)).toBe(2);
    expect(recommendedLevel(areas)).toBe(1);
  });

  it("falls back to the recommended level, then the first, for a depth it has no level for", () => {
    expect(startLevel({ ...areas, depth: 9 })).toBe(1);
    expect(startLevel({ ...areas, depth: 9, recommendedDepth: 8 })).toBe(0);
  });

  it("fills the track up to the selected level", () => {
    expect([sliderFill(areas, 0), sliderFill(areas, 3)]).toEqual([0, 1]);
    expect(sliderFill({ ...areas, levels: [level(1, [])] }, 0)).toBe(0);
  });

  it("words the status and the recommendation", () => {
    expect(levelStatus(level(2, [], 11))).toBe("11 non-overlapping areas");
    expect(recommendationHeadline(areas)).toBe(
      "Level 2 · 11 areas for 7 active contributors",
    );
    expect(inactiveLegend(183)).toBe("Inactive for 6+ months");
  });
});

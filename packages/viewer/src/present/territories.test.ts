import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { territoryViews } from "./territories.js";

type Territory = Report["knowledge"]["territories"]["territories"][number];

const [maya, tomas, priya] = sampleReport().contributors;
const stats = sampleReport().stats;

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

const territory = (overrides: Partial<Territory>): Territory => ({
  path: "packages/db",
  files: 20,
  truckFactor: 3,
  island: false,
  orphaned: false,
  experts: [],
  reasons: [],
  kind: "package",
  lastChangedAt: "2026-08-14T08:00:00.000Z",
  stats,
  badges: [],
  totalTerritories: 0,
  territories: [],
  ...overrides,
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
      contributors: {
        ...report.overview.contributors,
        total: solo ? 1 : 8,
        allTime: solo ? 1 : 8,
      },
    },
  };
};

describe("territoryViews", () => {
  const [card, other, root] = territoryViews(
    [
      territory({
        experts: [
          expert("Ann", 12, 0.6),
          expert("Bo", 5, 0.25, false),
          expert("Cy", 2, 0.1),
          expert("Di", 1, 0.05),
        ],
      }),
      territory({ path: "src", kind: "other", files: 5, truckFactor: 1 }),
      territory({ path: ".", files: 10, truckFactor: 2 }),
    ],
    reportOf(),
  );

  it("says when the territory last changed, relative to the report's date", () => {
    // 14 Aug to 2 Oct 2026 is 49 days
    expect(card?.changed).toBe("7 weeks ago");
  });

  it("splits a path into a dimmed parent and the territory's own name", () => {
    expect([card?.parent, card?.leaf]).toEqual(["packages/", "db/"]);
    expect([root?.parent, root?.leaf]).toEqual(["", "/ (root)"]);
  });

  it("marks the grouped small territories as other files", () => {
    expect([card?.other, other?.other]).toEqual([false, true]);
  });

  it("shares the files of the territory out of all files, and sizes it against the biggest territory", () => {
    expect([card?.share, other?.share, card?.sizeFraction]).toEqual([
      "20%",
      "5%",
      1,
    ]);
  });

  it("writes a handful of files out of thousands as under one percent, not zero", () => {
    const report = reportOf();
    const [few] = territoryViews([territory({ files: 1 })], {
      ...report,
      knowledge: { ...report.knowledge, files: 435 },
    });

    expect(few?.share).toBe("<1%");
  });

  it("grades the truck factor: 1 critical, 2 a warning, more nothing", () => {
    expect([card?.risk, other?.risk, root?.risk]).toEqual([
      "none",
      "crit",
      "warn",
    ]);
  });
});

describe("the scoped file", () => {
  it("is named without a trailing slash, unlike a folder of one file", () => {
    const scoped: Report = {
      ...reportOf(),
      repository: { ...reportOf().repository, scope: "src/bin.ts" },
    };
    const [file, folder] = territoryViews(
      [
        territory({ path: "src/bin.ts", kind: "folder", files: 1 }),
        territory({ path: "src/lib", kind: "folder", files: 1 }),
      ],
      scoped,
    );

    expect([file?.parent, file?.leaf, file?.file]).toEqual([
      "src/",
      "bin.ts",
      true,
    ]);
    expect([folder?.leaf, folder?.file]).toEqual(["lib/", false]);
  });
});

describe("the experts of a card", () => {
  const [card, other] = territoryViews(
    [
      territory({
        experts: [
          expert("Ann", 12, 0.6),
          expert("Bo", 5, 0.25, false),
          expert("Cy", 2, 0.1),
          expert("Di", 1, 0.05),
        ],
      }),
      territory({ path: "src", kind: "other", files: 5 }),
    ],
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

  it("lists the three biggest experts, flags the dormant and counts the rest", () => {
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
    expect(other?.unclaimed).toBe(5);
  });
});

const badge = (kind: "island" | "well-tested" | "one-expert" | "quiet") => ({
  kind,
  category: "knowledge" as const,
  label: kind,
  evidence: "because",
});

describe("the badges of a solo repository", () => {
  const withBadges = territory({
    badges: [
      badge("island"),
      badge("one-expert"),
      badge("well-tested"),
      badge("quiet"),
    ],
  });

  it("keeps only the badges that do not rest on several people", () => {
    const [solo] = territoryViews([withBadges], reportOf(true));

    expect(solo?.badges.chips.map(({ label }) => label)).toEqual([
      "well-tested",
      "quiet",
    ]);
  });

  it("keeps every badge of a team whose window shows one author", () => {
    const report = reportOf();
    const narrow: Report = {
      ...report,
      overview: {
        ...report.overview,
        contributors: { ...report.overview.contributors, total: 1 },
      },
    };
    const [team] = territoryViews([withBadges], narrow);

    expect(team?.badges.chips).toHaveLength(3);
  });

  it("keeps every badge with a team", () => {
    const [team] = territoryViews([withBadges], reportOf());

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
    const [card] = territoryViews(
      [territory({ lineOwners: owners })],
      reportOf(),
    );

    expect(card?.lineOwners).toEqual([
      { name: "Ann", share: "70%", kind: "human" },
      { name: "Bot", share: "20%", kind: "bot" },
      { name: "Cy", share: "5%", kind: "human" },
    ]);
  });

  it("has none without blame", () => {
    const [card] = territoryViews([territory({})], reportOf());

    expect(card?.lineOwners).toBeNull();
  });
});

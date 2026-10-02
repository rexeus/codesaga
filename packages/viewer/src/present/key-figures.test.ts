import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { keyFigures } from "./key-figures.js";

const figureOf = (label: string, report = sampleReport()) => {
  const figure = keyFigures(report).find((entry) => entry.label === label);
  if (figure === undefined) {
    throw new Error(`no key figure "${label}"`);
  }
  return figure;
};

const withWeeks = (weekly: readonly number[]): Report => {
  const report = sampleReport();
  return {
    ...report,
    overview: {
      ...report.overview,
      commits: weekly.reduce((total, commits) => total + commits, 0),
    },
    activity: {
      ...report.activity,
      weeks: weekly.map((commits, index) => ({
        start: `2026-01-${String(index + 1).padStart(2, "0")}`,
        commits,
        added: 10,
        deleted: 4,
      })),
    },
  };
};

describe("keyFigures", () => {
  it("shows the commits, active contributors, lines and truck factor of the report", () => {
    expect(
      keyFigures(sampleReport()).map(({ label, value, unit }) => [
        label,
        value,
        unit,
      ]),
    ).toEqual([
      ["Commits", "2,246", null],
      ["Active contributors", "4", "of 8 all-time"],
      ["Lines of code", "60,942", "in 473 files"],
      ["Truck factor", "2", "people"],
    ]);
  });

  it("has no AI share", () => {
    expect(keyFigures(sampleReport()).map(({ label }) => label)).not.toContain(
      "AI share",
    );
  });

  it("names the truck factor in the singular and marks a solo repository", () => {
    const report = sampleReport();
    const solo: Report = {
      ...report,
      overview: {
        ...report.overview,
        contributors: { total: 1, active30: 1, active90: 1, active365: 1 },
      },
      knowledge: {
        ...report.knowledge,
        truckFactor: { ...report.knowledge.truckFactor, value: 1 },
      },
    };

    expect(figureOf("Truck factor", solo)).toMatchObject({
      unit: "person",
      foot: { kind: "people", count: 1, solo: true },
    });
    expect(figureOf("Contributors", solo)).toMatchObject({
      value: "1",
      unit: "solo project",
      trend: null,
      foot: { kind: "person", name: "Maya Lindqvist", initials: "ML" },
    });
  });

  it("splits the lines of code into language shares", () => {
    const { foot } = figureOf("Lines of code");

    expect(foot.kind === "languages" && foot.shares[0]).toMatchObject({
      name: "TypeScript",
      percent: 76.2,
    });
  });
});

/** Two weeks of padding, then 12 weeks of `before` commits and 12 of `recent`. */
const twoPeriods = (before: number, recent: number): number[] => [
  0,
  0,
  ...Array.from({ length: 12 }, () => before),
  ...Array.from({ length: 12 }, () => recent),
];

describe("the commits figure", () => {
  it("compares the last 12 weeks with the 12 before them", () => {
    expect(figureOf("Commits", withWeeks(twoPeriods(2, 3))).foot).toEqual({
      kind: "delta",
      text: "+50%",
      direction: "up",
      against: "vs previous 12 weeks",
    });
  });

  it("shows a fall as down", () => {
    expect(figureOf("Commits", withWeeks(twoPeriods(4, 3))).foot).toMatchObject(
      {
        text: "−25%",
        direction: "down",
      },
    );
  });

  it("falls back to the weekly pace for a history too short to compare", () => {
    const { foot } = figureOf("Commits", withWeeks([6, 3, 3]));

    expect(foot).toEqual({ kind: "caption", text: "about 4 per week" });
    expect(figureOf("Commits", withWeeks([4, 5])).foot).toEqual({
      kind: "caption",
      text: "about 4.5 per week",
    });
  });
});

describe("the commits figure with a comparison", () => {
  it("uses the comparison of the report when there is one", () => {
    const report: Report = {
      ...sampleReport(),
      comparison: {
        previous: {
          since: "2025-10-15T00:00:00.000Z",
          until: "2026-01-15T00:00:00.000Z",
          partial: false,
          commits: 100,
          activeContributors: 6,
          added: 0,
          deleted: 0,
          automation: { human: 100, agentAssisted: 0, agent: 0, bot: 0 },
          aiShare: 0,
        },
        current: {
          commits: 118,
          activeContributors: 4,
          added: 0,
          deleted: 0,
          automation: { human: 118, agentAssisted: 0, agent: 0, bot: 0 },
          aiShare: 0,
        },
        delta: {
          commits: { change: 18, ratio: 0.183 },
          activeContributors: { change: -2, ratio: -0.25 },
          added: { change: 0, ratio: 0 },
          deleted: { change: 0, ratio: 0 },
          aiShare: 0,
        },
      },
    };

    expect(figureOf("Commits", report).foot).toEqual({
      kind: "delta",
      text: "+18%",
      direction: "up",
      against: "vs previous period",
    });
  });
});

describe("the lines of code trend", () => {
  it("accumulates the net lines of every week", () => {
    // every week adds 10 and deletes 4
    expect(
      figureOf("Lines of code", withWeeks([1, 1, 1])).trend?.values,
    ).toEqual([6, 12, 18]);
  });

  it("has no trend for a single week", () => {
    expect(figureOf("Lines of code", withWeeks([1])).trend).toBeNull();
  });
});

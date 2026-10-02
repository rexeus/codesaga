import { describe, expect, it } from "vitest";

import { areaBadges, contributorBadges } from "./badges.js";

const badge = <Kind extends string>(kind: Kind, label: string = kind) => ({
  kind,
  label,
  evidence: `${label} because of the numbers`,
});

describe("areaBadges", () => {
  it("shows up to three badges in the order of the report, with their rule as evidence", () => {
    const row = areaBadges([
      badge("orphaned", "Orphaned"),
      badge("island", "Knowledge island"),
    ]);

    expect(row.more).toBeNull();
    expect(row.chips).toEqual([
      {
        icon: "ghost",
        tone: "crit",
        label: "Orphaned",
        evidence: "Orphaned because of the numbers",
      },
      {
        icon: "island",
        tone: "warn",
        label: "Knowledge island",
        evidence: "Knowledge island because of the numbers",
      },
    ]);
  });

  it("folds the badges beyond the third into a count that names them", () => {
    const row = areaBadges([
      badge("orphaned", "Orphaned"),
      badge("island", "Island"),
      badge("quiet", "Quiet"),
      badge("new", "New"),
      badge("well-tested", "Well tested"),
    ]);

    expect(row.chips.map(({ label }) => label)).toEqual([
      "Orphaned",
      "Island",
      "Quiet",
    ]);
    expect(row.more).toEqual({ count: 2, labels: "New, Well tested" });
  });
});

describe("contributorBadges", () => {
  it("draws welcome as news and the achievements plain", () => {
    const row = contributorBadges([
      badge("welcome", "Welcome"),
      badge("keeper", "Keeper of docs"),
    ]);

    expect(row.chips.map(({ tone, icon }) => [tone, icon])).toEqual([
      ["info", "spark"],
      ["plain", "key"],
    ]);
  });

  it("has an empty row without badges", () => {
    expect(contributorBadges([])).toEqual({ chips: [], more: null });
  });
});

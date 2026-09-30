import { describe, expect, it } from "vitest";

import { countScale, countTicks, timeAxisOf } from "./time-axis.js";

const utc = (date: string): number => Date.parse(`${date}T00:00:00Z`);

describe("timeAxisOf labels", () => {
  it("names months when the ticks are a month or more apart", () => {
    const axis = timeAxisOf([utc("2025-11-01"), utc("2026-05-01")], 900);

    expect(axis.ticks.map(({ label }) => label)).toStrictEqual([
      "Nov",
      "Dec",
      "2026",
      "Feb",
      "Mar",
      "Apr",
      "May",
    ]);
  });

  it("names the day when the ticks are less than a month apart", () => {
    const axis = timeAxisOf([utc("2026-09-01"), utc("2026-10-06")], 900);
    const labels = axis.ticks.map(({ label }) => label);

    expect(labels.slice(0, 3)).toStrictEqual(["Sep 2", "Sep 4", "Sep 6"]);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("countTicks", () => {
  it("skips fractions when the largest count is one", () => {
    const ticks = countTicks(countScale([0, 1], 100), 4);

    expect(ticks.map(({ label }) => label)).toStrictEqual(["0", "1"]);
  });
});

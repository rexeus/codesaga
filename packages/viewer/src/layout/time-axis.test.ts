import { describe, expect, it } from "vitest";

import { countScale, countTicks, timeAxisOf } from "./time-axis.js";

const utc = (date: string): number => Date.parse(`${date}T00:00:00Z`);

describe("timeAxisOf labels", () => {
  it("names months with their year when the ticks are a month or more apart", () => {
    const axis = timeAxisOf([utc("2025-11-01"), utc("2026-05-01")], 900);

    expect(axis.ticks.map(({ label }) => label)).toStrictEqual([
      "Nov ’25",
      "Dec ’25",
      "Jan ’26",
      "Feb ’26",
      "Mar ’26",
      "Apr ’26",
      "May ’26",
    ]);
  });

  it("opens a mid-month span with its month and drops months that would crowd a label", () => {
    // 5 Jun to 5 Dec 2025 over 366 px is 2 px a day: a month is 60 to 62 px,
    // under the 64 px a label needs, so every second month is cut
    const axis = timeAxisOf([utc("2025-06-05"), utc("2025-12-05")], 366);

    expect(axis.ticks.map(({ label }) => label)).toStrictEqual([
      "Jun ’25",
      "Aug ’25",
      "Oct ’25",
      "Dec ’25",
    ]);
    expect(axis.ticks[0]?.position).toBe(0);
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

  it("writes the ticks with the given labeller", () => {
    const ticks = countTicks(
      countScale([-2, 2], 100),
      4,
      (value) => `${value}!`,
    );

    expect(ticks.map(({ label }) => label)).toStrictEqual([
      "-2!",
      "-1!",
      "0!",
      "1!",
      "2!",
    ]);
  });
});

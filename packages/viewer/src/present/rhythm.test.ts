import { describe, expect, it } from "vitest";

import { hourTotals, isNightHour, rhythmOf, weekdayTotals } from "./rhythm.js";

const punchcard = (cells: Record<string, number>): number[][] =>
  Array.from({ length: 7 }, (_row, row) =>
    Array.from({ length: 24 }, (_hour, hour) => cells[`${row}:${hour}`] ?? 0),
  );

describe("rhythmOf", () => {
  it("shares the weekend and night commits out of all commits", () => {
    // Monday 10:00 (6), Tuesday 23:00 (2), Saturday 03:00 (1), Sunday 10:00 (1)
    const rhythm = rhythmOf(
      punchcard({ "0:10": 6, "1:23": 2, "5:3": 1, "6:10": 1 }),
    );

    expect(rhythm).toEqual({
      weekendShare: 0.2,
      nightShare: 0.3,
      busiestHour: 10,
    });
  });

  it("has no rhythm without commits", () => {
    expect(rhythmOf(punchcard({}))).toBeNull();
  });
});

describe("the sums of a punchcard", () => {
  const cells = punchcard({ "0:10": 6, "1:10": 2, "5:3": 1 });

  it("adds the weekdays up per hour and the hours up per weekday", () => {
    expect(hourTotals(cells)[10]).toBe(8);
    expect(weekdayTotals(cells)).toEqual([6, 2, 0, 0, 0, 1, 0]);
  });

  it("counts 22:00 to 04:59 as night", () => {
    expect([21, 22, 23, 0, 4, 5].map((hour) => isNightHour(hour))).toEqual([
      false,
      true,
      true,
      true,
      true,
      false,
    ]);
  });
});

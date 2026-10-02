import { describe, expect, it } from "vitest";

import {
  hourTotals,
  isNightHour,
  nightLabel,
  rhythmOf,
  weekdayTotals,
} from "./rhythm.js";

const NIGHT = { nightFromHour: 22, nightToHour: 5 };

const nightOf = (hours: readonly number[], window: typeof NIGHT): boolean[] => {
  const isNight = isNightHour(window);
  return hours.map((hour) => isNight(hour));
};

const punchcard = (cells: Record<string, number>): number[][] =>
  Array.from({ length: 7 }, (_row, row) =>
    Array.from({ length: 24 }, (_hour, hour) => cells[`${row}:${hour}`] ?? 0),
  );

describe("rhythmOf", () => {
  it("shares the weekend and night commits out of all commits", () => {
    // Monday 10:00 (6), Tuesday 23:00 (2), Saturday 03:00 (1), Sunday 10:00 (1)
    const rhythm = rhythmOf(
      punchcard({ "0:10": 6, "1:23": 2, "5:3": 1, "6:10": 1 }),
      NIGHT,
    );

    expect(rhythm).toEqual({
      weekendShare: 0.2,
      nightShare: 0.3,
      busiestHour: 10,
    });
  });

  it("has no rhythm without commits", () => {
    expect(rhythmOf(punchcard({}), NIGHT)).toBeNull();
  });
});

describe("the sums of a punchcard", () => {
  const cells = punchcard({ "0:10": 6, "1:10": 2, "5:3": 1 });

  it("adds the weekdays up per hour and the hours up per weekday", () => {
    expect(hourTotals(cells)[10]).toBe(8);
    expect(weekdayTotals(cells)).toEqual([6, 2, 0, 0, 0, 1, 0]);
  });

  it("counts 22:00 to 04:59 as night", () => {
    expect(nightOf([21, 22, 23, 0, 4, 5], NIGHT)).toEqual([
      false,
      true,
      true,
      true,
      true,
      false,
    ]);
  });
});

describe("the night window of the report", () => {
  it("follows the thresholds and also reads a night that does not cross midnight", () => {
    const early = { nightFromHour: 1, nightToHour: 6 };

    expect(nightOf([0, 1, 5, 6, 23], early)).toEqual([
      false,
      true,
      true,
      false,
      false,
    ]);
    expect(nightLabel(early)).toBe("01:00 to 06:00");
    expect(nightLabel(NIGHT)).toBe("22:00 to 05:00");
  });

  it("shares the commits of the configured night", () => {
    const cells = punchcard({ "0:2": 1, "0:23": 3 });

    expect(
      rhythmOf(cells, { nightFromHour: 1, nightToHour: 6 })?.nightShare,
    ).toBe(0.25);
  });
});

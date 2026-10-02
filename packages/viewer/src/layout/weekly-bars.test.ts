import { describe, expect, it } from "vitest";

import { layoutWeeklyBars } from "./weekly-bars.js";

const SIZE = { width: 40, height: 28 };

describe("layoutWeeklyBars", () => {
  it("scales the bars to the busiest week and leaves empty weeks out", () => {
    const bars = layoutWeeklyBars([0, 5, 10, 0], SIZE, 2);

    // 10 px per week; the busiest week is 25 px tall (28 less the 3 px floor), half of it 12.5
    expect(
      bars.map(({ x, y, width, height }) => [x, y, width, height]),
    ).toEqual([
      [10, 15.5, 9, 12.5],
      [20, 3, 9, 25],
    ]);
  });

  it("keeps a single commit visible and marks the last weeks as recent", () => {
    const bars = layoutWeeklyBars([1, 100, 0, 1], SIZE, 2);

    expect(bars.map(({ height }) => height)).toEqual([3, 25, 3]);
    expect(bars.map(({ recent }) => recent)).toEqual([false, false, true]);
  });

  it("keeps narrow bars at least 1.5 px wide", () => {
    const wide = layoutWeeklyBars(
      Array.from({ length: 52 }, () => 1),
      { width: 52, height: 28 },
      12,
    );

    expect(wide[0]?.width).toBe(1.5);
  });
});

import { describe, expect, it } from "vitest";

import { layoutTrend } from "./trend.js";

// 344 x 190 leaves a 300 x 150 plot (margins: 14 top, 26 bottom, 38 left, 6 right).
const SIZE = { width: 344, height: 190 };
const months = ["2025-01", "2025-02", "2025-03", "2025-04"];
const label = String;

describe("layoutTrend", () => {
  it("draws no line for fewer than two months", () => {
    expect(layoutTrend(["2025-01"], [3], SIZE, label)).toBeNull();
    expect(layoutTrend([], [], SIZE, label)).toBeNull();
  });

  it("puts the first month at the left edge and the last at the right edge", () => {
    const layout = layoutTrend(months, [1, 2, 3, 4], SIZE, label);

    expect(layout?.points[0]?.x).toBe(0);
    expect(layout?.points.at(-1)?.x).toBe(300);
  });

  it("spreads the months by date, so a longer month takes more room", () => {
    const layout = layoutTrend(months, [1, 2, 3, 4], SIZE, label);
    const [, b, c] = layout?.points ?? [];

    // January has 31 days and February 28, of 90 days from January to April
    expect(b?.x).toBeCloseTo((31 / 90) * 300, 3);
    expect(c?.x).toBeCloseTo((59 / 90) * 300, 3);
  });

  it("scales from zero to the highest value, the highest on the plot top", () => {
    const layout = layoutTrend(months, [0, 5, 10, 5], SIZE, label);

    expect(layout?.points.map(({ y }) => y)).toEqual([150, 75, 0, 75]);
    expect(layout?.zero).toBe(150);
  });

  it("labels the value axis with the caller's format", () => {
    const layout = layoutTrend(
      months,
      [0, 5, 10, 5],
      SIZE,
      (value) => `${value}%`,
    );

    expect(layout?.ticks.map(({ label: text }) => text)).toEqual([
      "0%",
      "5%",
      "10%",
    ]);
  });
});

describe("layoutTrend with gaps", () => {
  it("breaks the line at a month without a value and dots the lone points", () => {
    const layout = layoutTrend(months, [1, null, 3, 4], SIZE, label);

    // the first value has no neighbour to join, the last one always gets a dot
    expect(layout?.points[1]?.y).toBeNull();
    expect(layout?.path.split("M").filter(Boolean)).toHaveLength(2);
    expect(layout?.dots).toHaveLength(2);
    expect(layout?.dots[0]?.x).toBe(0);
  });

  it("has no path and one dot for a single value", () => {
    const layout = layoutTrend(months, [null, null, null, 2], SIZE, label);

    expect(layout?.path).toBe("");
    expect(layout?.dots).toHaveLength(1);
  });

  it("scales an all-zero series against one, so the line lies on the baseline", () => {
    const layout = layoutTrend(months, [0, 0, 0, 0], SIZE, label);

    expect(layout?.points.every(({ y }) => y === 150)).toBe(true);
  });
});

describe("layoutTrend zones", () => {
  it("gives each month a zone up to the midpoint to its neighbours, covering the plot", () => {
    const layout = layoutTrend(months, [1, 2, 3, 4], SIZE, label);
    const zones = layout?.zones ?? [];

    expect(zones[0]?.x).toBe(0);
    const end = zones.at(-1);
    expect((end?.x ?? 0) + (end?.width ?? 0)).toBeCloseTo(300, 6);
    expect(zones.reduce((sum, { width }) => sum + width, 0)).toBeCloseTo(
      300,
      6,
    );
  });
});

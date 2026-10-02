import { describe, expect, it } from "vitest";

import { layoutSparkline } from "./sparkline.js";

const SIZE = { width: 104, height: 40 };

describe("layoutSparkline", () => {
  it("puts the lowest value at the bottom and the highest at the top, end to end", () => {
    const sparkline = layoutSparkline([2, 10, 6], SIZE, 2);

    // x runs from 2 to 102; y from 35 (height less 5) up to 7
    expect(sparkline?.history).toBe("M2.0,35.0L52.0,7.0L102.0,21.0");
    expect(sparkline?.end).toEqual({ x: 102, y: 21 });
  });

  it("draws the recent values as their own line", () => {
    const sparkline = layoutSparkline([2, 10, 6], SIZE, 2);

    expect(sparkline?.recent).toBe("M52.0,7.0L102.0,21.0");
  });

  it("closes the area down to the bottom edge", () => {
    const sparkline = layoutSparkline([2, 10, 6], SIZE, 2);

    expect(sparkline?.area.endsWith("L102.0,40L2.0,40Z")).toBe(true);
  });

  it("draws a flat history in the middle of nothing instead of dividing by zero", () => {
    expect(layoutSparkline([3, 3, 3], SIZE, 1)?.history).toBe(
      "M2.0,35.0L52.0,35.0L102.0,35.0",
    );
  });

  it("has no shape for fewer than two values", () => {
    expect(layoutSparkline([4], SIZE, 1)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  compareOnBar,
  formatWhole,
  formatShare,
  indentationOf,
  pathTail,
  rangePosition,
} from "./code-stats.js";

describe("formatWhole", () => {
  it("rounds to the nearest whole number and separates thousands", () => {
    expect([formatWhole(121), formatWhole(1199.6), formatWhole(131.5)]).toEqual(
      ["121", "1,200", "132"],
    );
  });
});

describe("formatShare", () => {
  it("writes a small non-zero share as under one percent, and none as zero", () => {
    expect([
      formatShare(3, 1000),
      formatShare(0, 1000),
      formatShare(45, 100),
    ]).toEqual(["<1%", "0%", "45%"]);
  });

  it("does not divide by zero", () => {
    expect(formatShare(0, 0)).toBe("0%");
  });
});

describe("pathTail", () => {
  it("keeps the last two steps of a path", () => {
    expect([pathTail("src/github/context.ts"), pathTail("run.ts")]).toEqual([
      "github/context.ts",
      "run.ts",
    ]);
  });
});

describe("indentationOf", () => {
  it("names the width of space indentation and the split behind it", () => {
    expect(
      indentationOf({ spacesShare: 0.9, tabsShare: 0.1, width: 2 }),
    ).toEqual({
      headline: "2 spaces",
      split: "90% spaces, 10% tabs",
      spacesShare: 0.9,
      tabsShare: 0.1,
    });
  });

  it("calls tab-led code tabs and code without indentation by that name", () => {
    expect(
      indentationOf({ spacesShare: 0.2, tabsShare: 0.8, width: 4 }).headline,
    ).toBe("Tabs");
    expect(
      indentationOf({ spacesShare: 0, tabsShare: 0, width: 0 }),
    ).toMatchObject({
      headline: "No indented lines",
      split: "",
    });
  });
});

describe("compareOnBar", () => {
  it("puts both figures on one bar with room to spare to the right", () => {
    // the larger figure, 10, sits at 10 / (10 * 1.12)
    const { value, reference } = compareOnBar(5, 10);

    expect(value).toBeCloseTo(0.4464, 4);
    expect(reference).toBeCloseTo(0.8929, 4);
  });

  it("keeps both at the start when both are zero", () => {
    expect(compareOnBar(0, 0)).toEqual({ value: 0, reference: 0 });
  });
});

describe("rangePosition", () => {
  it("places the median on a logarithmic line between the shortest and the longest file", () => {
    // ln 10 is half of ln 100
    expect(rangePosition(1, 10, 100)).toBeCloseTo(0.5, 5);
  });

  it("keeps the dot inside the track, and in the middle for equal lengths", () => {
    expect([
      rangePosition(1, 1, 100),
      rangePosition(1, 100, 100),
      rangePosition(7, 7, 7),
    ]).toEqual([0.04, 0.96, 0.5]);
  });
});

import { describe, expect, it } from "vitest";

import { layoutPunchcard } from "./punchcard.js";

// A 296 px chart has a 240 px plot: 10 px cells, so the largest dot fits a
// 5 px half cell less a 1 px margin.
const WIDTH = 296;

const punchcard = (cells: Record<string, number>): number[][] =>
  Array.from({ length: 7 }, (_row, row) =>
    Array.from({ length: 24 }, (_hour, hour) => cells[`${row}:${hour}`] ?? 0),
  );

describe("layoutPunchcard", () => {
  const layout = layoutPunchcard(punchcard({ "0:6": 4, "1:14": 16 }), WIDTH);

  it("gives the busiest cell the largest dot and others an area in proportion", () => {
    // 4 commits are a quarter of 16, so a quarter of the area: half the radius
    expect(layout.dots.map(({ radius }) => radius)).toEqual([2, 4]);
  });

  it("draws no dot for a cell without commits", () => {
    expect(layout.dots).toHaveLength(2);
    expect(layout.cells).toHaveLength(168);
  });

  it("centres a dot in its cell", () => {
    const tuesday = layout.dots.find(({ cell }) => cell.weekday === "Tue");

    expect([tuesday?.cx, tuesday?.cy]).toEqual([145, 15]);
  });

  it("names the busiest cell", () => {
    expect(layout.busiest).toMatchObject({
      weekday: "Tue",
      hour: 14,
      commits: 16,
    });
  });

  it("has no busiest cell and no dots without commits", () => {
    const empty = layoutPunchcard(punchcard({}), WIDTH);

    expect(empty.busiest).toBeNull();
    expect(empty.dots).toEqual([]);
  });
});

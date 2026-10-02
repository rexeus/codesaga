import { describe, expect, it } from "vitest";

import { layoutPunchcard } from "./punchcard.js";

// A 278 px chart has a 234 px plot (38 px left, 6 px right margin): 9.75 px
// cells. 4 commits are a fifth of 20 (level 1) and 16 are four fifths (level 4).
const WIDTH = 278;

const punchcard = (cells: Record<string, number>): number[][] =>
  Array.from({ length: 7 }, (_row, row) =>
    Array.from({ length: 24 }, (_hour, hour) => cells[`${row}:${hour}`] ?? 0),
  );

describe("layoutPunchcard", () => {
  const layout = layoutPunchcard(
    punchcard({ "0:6": 4, "1:14": 16, "2:3": 20 }),
    WIDTH,
  );
  const cellAt = (weekday: string, hour: number) =>
    layout.cells.find((cell) => cell.weekday === weekday && cell.hour === hour);

  it("shades each cell in five steps by its share of the busiest cell", () => {
    expect(
      [cellAt("Mon", 6), cellAt("Tue", 14), cellAt("Wed", 3)].map(
        (cell) => cell?.level,
      ),
    ).toEqual([1, 4, 5]);
  });

  it("leaves a cell without commits unshaded, and keeps a single commit visible", () => {
    const sparse = layoutPunchcard(punchcard({ "0:0": 1, "0:1": 1000 }), WIDTH);

    expect(layout.cells).toHaveLength(168);
    expect(cellAt("Thu", 12)?.level).toBe(0);
    expect(sparse.cells[0]?.level).toBe(1);
  });

  it("lays the cells out row by row from the top left", () => {
    expect([cellAt("Tue", 14)?.x, cellAt("Tue", 14)?.y]).toEqual([136.5, 9.75]);
  });

  it("names the busiest cell", () => {
    expect(layout.busiest).toMatchObject({
      weekday: "Wed",
      hour: 3,
      commits: 20,
    });
  });

  it("labels every sixth hour along the top edge of its cell", () => {
    expect(layout.hourTicks.map(({ label }) => label)).toEqual([
      "00:00",
      "06:00",
      "12:00",
      "18:00",
    ]);
    expect(layout.hourTicks[1]?.position).toBe(58.5);
  });

  it("has no busiest cell without commits", () => {
    expect(layoutPunchcard(punchcard({}), WIDTH).busiest).toBeNull();
  });
});

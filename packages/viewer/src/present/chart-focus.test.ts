import { describe, expect, it } from "vitest";

import { describeReading, moveFocus, resumeCell } from "./chart-focus.js";

const series = { rows: 1, columns: 5 };
const punchcard = { rows: 3, columns: 4 };

describe("moveFocus", () => {
  it("steps along a time series and stops at both ends", () => {
    expect(moveFocus(2, series, "ArrowLeft")).toBe(1);
    expect(moveFocus(2, series, "ArrowRight")).toBe(3);
  });

  it("leaves the key to the page when the focus would not move", () => {
    expect(moveFocus(0, series, "ArrowLeft")).toBeNull();
    expect(moveFocus(4, series, "ArrowRight")).toBeNull();
    expect(moveFocus(2, series, "ArrowUp")).toBeNull();
    expect(moveFocus(2, series, "ArrowDown")).toBeNull();
    expect(moveFocus(0, series, "Home")).toBeNull();
    expect(moveFocus(4, series, "End")).toBeNull();
  });

  it("moves an index outside the grid to the nearest cell", () => {
    expect(moveFocus(9, series, "ArrowRight")).toBe(4);
    expect(moveFocus(-3, series, "ArrowLeft")).toBe(0);
  });

  it("jumps to the ends of a time series with Home and End", () => {
    expect(moveFocus(2, series, "Home")).toBe(0);
    expect(moveFocus(2, series, "End")).toBe(4);
  });

  it("moves between rows of a grid and stops at the top and bottom row", () => {
    expect(moveFocus(5, punchcard, "ArrowUp")).toBe(1);
    expect(moveFocus(5, punchcard, "ArrowDown")).toBe(9);
    expect(moveFocus(1, punchcard, "ArrowUp")).toBeNull();
    expect(moveFocus(9, punchcard, "ArrowDown")).toBeNull();
    expect(moveFocus(4, punchcard, "ArrowLeft")).toBeNull();
    expect(moveFocus(7, punchcard, "ArrowRight")).toBeNull();
  });

  it("jumps within the row on Home and End, and across the grid with ctrl", () => {
    expect(moveFocus(5, punchcard, "Home")).toBe(4);
    expect(moveFocus(5, punchcard, "End")).toBe(7);
    expect(moveFocus(5, punchcard, "Home", true)).toBe(0);
    expect(moveFocus(5, punchcard, "End", true)).toBe(11);
  });

  it("ignores keys that do not navigate and charts without cells", () => {
    expect(moveFocus(2, series, "Tab")).toBeNull();
    expect(moveFocus(0, { rows: 1, columns: 0 }, "ArrowRight")).toBeNull();
  });
});

describe("resumeCell", () => {
  it("keeps the visited cell and clamps it to a smaller layout", () => {
    expect(resumeCell(3, 10, 9)).toBe(3);
    expect(resumeCell(8, 5, 4)).toBe(4);
  });

  it("starts where the chart starts when nothing was visited", () => {
    expect(resumeCell(null, 10, 9)).toBe(9);
  });
});

describe("describeReading", () => {
  it("reads the title and every row as one sentence", () => {
    expect(
      describeReading({
        title: "Week of 2026-03-02",
        rows: [
          { label: "lines added", value: "1,200" },
          { label: "lines deleted", value: "300" },
        ],
      }),
    ).toBe("Week of 2026-03-02: 1,200 lines added, 300 lines deleted");
  });
});

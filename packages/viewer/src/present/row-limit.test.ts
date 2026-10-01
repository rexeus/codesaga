import { describe, expect, it } from "vitest";

import { showAllLabel, visibleRows } from "./row-limit.js";

const limit = { rows: 3, noun: "directories" };

describe("visibleRows", () => {
  it("keeps the first rows until the reader asks for all", () => {
    expect(visibleRows([1, 2, 3, 4, 5], limit, false)).toEqual([1, 2, 3]);
    expect(visibleRows([1, 2, 3, 4, 5], limit, true)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps every row of a short table", () => {
    expect(visibleRows([1, 2], limit, false)).toEqual([1, 2]);
  });
});

describe("showAllLabel", () => {
  it("names the rows and groups thousands", () => {
    expect(showAllLabel(72, limit)).toBe("Show all 72 directories");
    expect(showAllLabel(1234, { rows: 100, noun: "contributors" })).toBe(
      "Show all 1,234 contributors",
    );
  });
});

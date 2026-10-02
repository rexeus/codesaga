import { describe, expect, it } from "vitest";

import type { TrendInput } from "../trend-input.js";
import { tightened } from "./tightened.js";

/** Months from 2024-01 with 10,000 production lines throughout and the given escape hatches. */
const trendsOf = (escapes: ReadonlyArray<number>): TrendInput => ({
  months: escapes.map(
    (_, index) =>
      `${2024 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`,
  ),
  series: {
    "production.escapes": escapes,
    "production.lines": escapes.map(() => 10_000),
  },
  events: [],
});

const TODAY = "2026-07-01";

describe("tightened", () => {
  it("is reached the month the rate is half of the peak, on that month's last day", () => {
    // Rates per 1,000 lines: 5, 10, 20 (peak, 2024-03), 15, 11, 10 (2024-06), 8.
    const [achievement] = tightened(
      trendsOf([50, 100, 200, 150, 110, 100, 80]),
      TODAY,
    );

    expect(achievement).toStrictEqual({
      kind: "tightened",
      title: "Tightened",
      reached: true,
      reachedAt: "2024-06-30",
      holds: "milestone",
      detail:
        "Escape hatches per 1,000 production lines fell from 20 in 2024-03 to 10 in 2024-06.",
      progress: null,
    });
  });

  it("is locked just above half of the peak, with the fall so far as progress", () => {
    const [achievement] = tightened(trendsOf([100, 200, 150, 101]), TODAY);

    expect(achievement).toStrictEqual({
      kind: "tightened",
      title: "Tightened",
      reached: false,
      reachedAt: null,
      holds: "milestone",
      detail:
        "10.1 escape hatches per 1,000 production lines, 20 at the peak in 2024-02.",
      progress: { value: 49, target: 50, unit: "% below the peak" },
    });
  });

  it("caps the day at today when the fall showed this month", () => {
    const [achievement] = tightened(trendsOf([100, 200, 100]), "2024-03-12");

    expect(achievement?.reachedAt).toBe("2024-03-12");
  });

  it("counts a fall that began before the history's last peak only from the peak", () => {
    // The earlier rate of 10 is not the peak; the peak 30 comes later and has not fallen yet.
    const [achievement] = tightened(trendsOf([100, 20, 300, 250]), TODAY);

    expect(achievement?.reached).toBe(false);
  });

  it("has no peak to fall from below 20 escape hatches", () => {
    const [achievement] = tightened(trendsOf([19, 5, 1]), TODAY);

    expect(achievement).toMatchObject({
      reached: false,
      progress: null,
    });
  });

  it("is absent without trends", () => {
    expect(tightened(undefined, TODAY)).toStrictEqual([]);
  });
});

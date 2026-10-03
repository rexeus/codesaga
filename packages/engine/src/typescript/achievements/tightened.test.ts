import { describe, expect, it } from "vitest";

import type { TrendInput } from "../trend-input.js";
import { tightened } from "./tightened.js";

const monthOf = (index: number): string =>
  `${2024 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;

/** Months from 2024-01 with 10,000 production lines throughout and the given escape hatches; each month's last commit is on its 27th. */
const trendsOf = (escapes: ReadonlyArray<number>): TrendInput => ({
  months: escapes.map((_, index) => monthOf(index)),
  series: {
    "production.escapes": escapes,
    "production.lines": escapes.map(() => 10_000),
  },
  events: [],
  lastCommitDays: escapes.map((_, index) => `${monthOf(index)}-27`),
});

describe("tightened", () => {
  it("is reached the first month the rate is half of the peak, on the day of that month's last commit", () => {
    // Rates per 1,000 lines: 5, 10, 20 (peak, 2024-03), 15, 11, 10 (2024-06), 8.
    const [achievement] = tightened(
      trendsOf([50, 100, 200, 150, 110, 100, 80]),
    );

    expect(achievement).toStrictEqual({
      kind: "tightened",
      title: "Tightened",
      reached: true,
      reachedAt: "2024-06-27",
      holds: "milestone",
      detail:
        "Escape hatches per 1,000 production lines fell from 20 in 2024-03 to 10 in 2024-06.",
      progress: null,
    });
  });

  it("stays reached at the same month after a later, higher peak", () => {
    // 10, 20 (peak), 10 (half of it: reached 2024-03), then a new peak of 40 and 30.
    const grown = tightened(trendsOf([100, 200, 100, 400, 300]));
    const atTheTime = tightened(trendsOf([100, 200, 100]));

    expect(grown).toStrictEqual(atTheTime);
    expect(grown[0]).toMatchObject({ reached: true, reachedAt: "2024-03-27" });
  });

  it("is locked just above half of the peak, with the fall so far as progress", () => {
    const [achievement] = tightened(trendsOf([100, 200, 150, 101]));

    expect(achievement).toStrictEqual({
      kind: "tightened",
      title: "Tightened",
      reached: false,
      reachedAt: null,
      holds: "milestone",
      detail:
        "10.1 escape hatches per 1,000 production lines, 20 at the peak in 2024-02 (series from 2024-01).",
      progress: { value: 49, target: 50, unit: "% below the peak" },
    });
  });

  it("is not reached by a rate that only rises", () => {
    expect(tightened(trendsOf([100, 150, 200]))[0]?.reached).toBe(false);
  });

  it("has no peak to fall from below 20 escape hatches", () => {
    expect(tightened(trendsOf([19, 5, 1]))[0]).toMatchObject({
      reached: false,
      progress: null,
    });
  });

  it("claims nothing before the first month it has", () => {
    // The series starts at its peak, as a history that starts late does.
    const [achievement] = tightened(trendsOf([200, 100]));

    expect(achievement).toMatchObject({
      reached: true,
      detail:
        "Escape hatches per 1,000 production lines fell from 20 in 2024-01 to 10 in 2024-02.",
    });
  });

  it("is absent without trends", () => {
    expect(tightened(undefined)).toStrictEqual([]);
  });
});

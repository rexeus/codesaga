import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import { at } from "../testing/classified-commit.js";
import { weeklyCommits } from "./weekly.js";

// Wednesday 2026-07-01; its week starts Monday 2026-06-29
const now = DateTime.makeUnsafe("2026-07-01T12:00:00Z");

describe("weeklyCommits", () => {
  it("returns 52 weeks of zeros without commits", () => {
    expect(weeklyCommits([], now)).toStrictEqual(
      Array.from({ length: 52 }, () => 0),
    );
  });

  it("counts the commits of the current week in the last entry", () => {
    const weeks = weeklyCommits(
      [at("2026-06-29T00:00:00Z"), at("2026-07-01T11:00:00Z")],
      now,
    );
    expect(weeks.at(-1)).toBe(2);
  });

  it("counts the previous week one entry earlier and starts weeks on Monday", () => {
    // Sunday 23:59:59 belongs to the week of Monday 2026-06-22
    const weeks = weeklyCommits([at("2026-06-28T23:59:59Z")], now);
    expect(weeks.at(-2)).toBe(1);
    expect(weeks.at(-1)).toBe(0);
  });

  it("puts the oldest of the 52 weeks first and drops older commits", () => {
    // The 52nd week back starts Monday 2025-07-07
    const weeks = weeklyCommits(
      [at("2025-07-07T00:00:00Z"), at("2025-07-06T23:59:59Z")],
      now,
    );
    expect(weeks[0]).toBe(1);
    expect(weeks.reduce((sum, count) => sum + count, 0)).toBe(1);
  });
});

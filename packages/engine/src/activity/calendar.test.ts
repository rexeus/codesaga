import { describe, expect, it } from "vitest";

import { at } from "../testing/classified-commit.js";
import { addMonths, monthsBetween } from "./calendar.js";

describe("addMonths", () => {
  it("keeps the day and time of day", () => {
    expect(addMonths(at("2026-01-15T10:30:00Z"), 3)).toBe(
      at("2026-04-15T10:30:00Z"),
    );
  });

  it("goes back across a year boundary", () => {
    expect(addMonths(at("2026-02-10T00:00:00Z"), -3)).toBe(
      at("2025-11-10T00:00:00Z"),
    );
  });

  it("clamps a missing day to the last day of the month", () => {
    expect(addMonths(at("2026-01-31T00:00:00Z"), 1)).toBe(
      at("2026-02-28T00:00:00Z"),
    );
  });
});

describe("monthsBetween", () => {
  it("counts a month once the same day and time of day is reached", () => {
    expect(
      monthsBetween(at("2026-01-15T00:00:00Z"), at("2026-07-15T00:00:00Z")),
    ).toBe(6);
    expect(
      monthsBetween(at("2026-01-15T00:00:00Z"), at("2026-07-14T23:59:59Z")),
    ).toBe(5);
  });

  it("is 0 when the end is not later than the start", () => {
    expect(
      monthsBetween(at("2026-07-15T00:00:00Z"), at("2026-01-15T00:00:00Z")),
    ).toBe(0);
  });
});

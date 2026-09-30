import { describe, expect, it } from "vitest";

import { formatAge } from "./format.js";

describe("formatAge", () => {
  it.each([
    ["2023-10-10T08:12:31.000Z", "2026-09-30T10:15:00.000Z", "2y 11m"],
    ["2023-10-10T08:12:31.000Z", "2026-10-10T08:12:31.000Z", "3y"],
    ["2026-01-31T00:00:00.000Z", "2026-03-01T00:00:00.000Z", "1 month"],
    ["2026-05-01T00:00:00.000Z", "2026-09-30T00:00:00.000Z", "4 months"],
    ["2026-09-16T00:00:00.000Z", "2026-09-30T00:00:00.000Z", "14 days"],
    ["2026-09-30T00:00:00.000Z", "2026-09-30T06:00:00.000Z", "0 days"],
  ])("measures %s to %s as %s", (from, to, expected) => {
    expect(formatAge(from, to)).toBe(expected);
  });
});

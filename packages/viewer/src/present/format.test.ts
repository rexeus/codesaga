import { describe, expect, it } from "vitest";

import {
  formatAge,
  formatAgo,
  formatCompact,
  formatDateLong,
  formatMonth,
  formatNoun,
  formatSignedCompact,
} from "./format.js";

describe("formatAge", () => {
  it.each([
    [
      "2023-10-10T08:12:31.000Z",
      "2026-09-30T10:15:00.000Z",
      "2 years and 11 months",
    ],
    ["2023-10-10T08:12:31.000Z", "2026-10-10T08:12:31.000Z", "3 years"],
    [
      "2025-05-19T00:00:00.000Z",
      "2026-10-02T00:00:00.000Z",
      "1 year and 4 months",
    ],
    ["2026-05-01T00:00:00.000Z", "2026-09-30T00:00:00.000Z", "4 months"],
    ["2026-07-12T00:00:00.000Z", "2026-10-02T00:00:00.000Z", "12 weeks"],
    ["2026-01-31T00:00:00.000Z", "2026-03-01T00:00:00.000Z", "4 weeks"],
    ["2026-09-16T00:00:00.000Z", "2026-09-30T00:00:00.000Z", "2 weeks"],
    ["2026-09-24T00:00:00.000Z", "2026-09-30T00:00:00.000Z", "6 days"],
    ["2026-09-29T00:00:00.000Z", "2026-09-30T00:00:00.000Z", "1 day"],
    ["2026-09-30T00:00:00.000Z", "2026-09-30T06:00:00.000Z", "0 days"],
  ])("measures %s to %s as %s", (from, to, expected) => {
    expect(formatAge(from, to)).toBe(expected);
  });
});

describe("formatCompact", () => {
  it.each([
    [950, "950"],
    [1500, "1.5k"],
    [2000, "2k"],
    [12_400, "12k"],
    [3_200_000, "3.2M"],
    [-5000, "5k"],
  ])("writes %d as %s", (value, expected) => {
    expect(formatCompact(value)).toBe(expected);
  });
});

describe("formatSignedCompact", () => {
  it.each([
    [5000, "+5k"],
    [-10_000, "−10k"],
    [0, "0"],
  ])("writes %d as %s", (value, expected) => {
    expect(formatSignedCompact(value)).toBe(expected);
  });
});

describe("dates in words", () => {
  it("writes a day with its month name and a month with its year", () => {
    expect(formatDateLong("2025-05-09T08:00:00.000Z")).toBe("9 May 2025");
    expect(formatMonth("2026-02")).toBe("Feb 2026");
  });
});

describe("formatAgo", () => {
  it.each([
    ["2026-10-02T23:00:00.000Z", "today"],
    ["2026-10-01T01:00:00.000Z", "yesterday"],
    ["2026-09-26T10:00:00.000Z", "6 days ago"],
    ["2026-08-14T10:00:00.000Z", "7 weeks ago"],
    ["2026-06-30T10:00:00.000Z", "3 months ago"],
    ["2024-06-30T10:00:00.000Z", "2 years ago"],
  ])("reads %s as %s", (timestamp, expected) => {
    expect(formatAgo(timestamp, "2026-10-02T09:00:00.000Z")).toBe(expected);
  });
});

describe("formatNoun", () => {
  it("keeps the noun singular for one and pluralizes everything else, zero included", () => {
    expect([
      formatNoun(1, "file"),
      formatNoun(0, "file"),
      formatNoun(1204, "line"),
    ]).toEqual(["1 file", "0 files", "1,204 lines"]);
  });
});

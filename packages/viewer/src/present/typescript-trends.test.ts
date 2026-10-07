import { describe, expect, it } from "vitest";

import { sampleBlock } from "../testing/reports.js";
import { startNote, trendChoices, trendLine } from "./typescript-trends.js";

const trends = sampleBlock("trends");

describe("trendChoices", () => {
  it("offers the five lines in a fixed order", () => {
    expect(trendChoices(trends, true).map(({ id }) => id)).toEqual([
      "escapes",
      "any",
      "complex",
      "esm",
      "cases",
    ]);
  });

  it("leaves out the two lines about types for a repository without types", () => {
    expect(trendChoices(trends, false).map(({ id }) => id)).toEqual([
      "complex",
      "esm",
      "cases",
    ]);
  });

  it("offers a line only when the report carries the series it needs", () => {
    const { "tests.testCases": _, ...series } = trends.series;

    expect(
      trendChoices({ ...trends, series }, true).map(({ id }) => id),
    ).not.toContain("cases");
    expect(trendChoices({ ...trends, series: {} }, true)).toEqual([]);
  });
});

describe("trendLine", () => {
  it("divides the escape sites by the lines of each month, per 1,000", () => {
    const line = trendLine(trends, "escapes");

    // 12 sites in 210 lines, and 7 in 420 at the end
    expect(line.values[0]).toBeCloseTo((12 * 1000) / 210, 6);
    expect(line.values.at(-1)).toBeCloseTo(7000 / 420, 6);
    expect(line.months).toEqual(trends.months);
  });

  it("words each month for the tooltip with the counts behind it", () => {
    const [first] = trendLine(trends, "escapes").details;

    expect(first).toEqual({
      label: "Jan 2026",
      value: (12 * 1000) / 210,
      figure: "57.1",
      detail: "12 sites in 210 lines",
    });
  });

  it("gives the share of complex functions as a percent", () => {
    const [first] = trendLine(trends, "complex").details;

    // 1 of 14 functions
    expect(first?.figure).toBe("7.1%");
    expect(first?.detail).toBe("1 of 14 functions");
  });

  it("gives the share of ES modules among the module files, and none for a month without any", () => {
    const line = trendLine(
      {
        ...trends,
        series: {
          ...trends.series,
          "production.esmFiles": [0, 3],
          "production.commonjsFiles": [0, 1],
        },
        months: ["2026-01", "2026-02"],
      },
      "esm",
    );

    expect(line.values).toEqual([null, 75]);
    expect(line.details[0]?.figure).toBe("–");
    expect(line.details[1]?.detail).toBe("3 ES module files, 1 CommonJS");
  });
});

describe("trendLine counts and gaps", () => {
  it("counts the test cases as they are", () => {
    const line = trendLine(trends, "cases");

    expect(line.values.slice(0, 3)).toEqual([4, 4, 9]);
    expect(line.details[0]?.detail).toBe("0 focused, in 1 test file");
  });

  it("has no value for a month without lines instead of dividing by zero", () => {
    const line = trendLine(
      { ...trends, months: ["2026-01"], series: { "production.lines": [0] } },
      "any",
    );

    expect(line.values).toEqual([null]);
  });

  it("writes the axis of a rate, a percent and a count with the digits of the step", () => {
    const rate = trendLine(trends, "escapes").axis;
    const percent = trendLine(trends, "complex").axis;
    const cases = trendLine(trends, "cases").axis;

    expect([
      rate.label(20, 0),
      rate.label(0.2, 1),
      rate.label(0.05, 2),
    ]).toEqual(["20", "0.2", "0.05"]);
    // a maximum below 1 must not print 0% / 1% / 1%
    expect([
      percent.label(0, 1),
      percent.label(0.5, 1),
      percent.label(10, 0),
    ]).toEqual(["0.0%", "0.5%", "10%"]);
    expect(cases.label(1500, 0)).toBe("1.5k");
    expect([rate.whole, percent.whole, cases.whole]).toEqual([
      false,
      false,
      true,
    ]);
  });
});

describe("startNote", () => {
  it("says where the series starts when that is after the repository's first commit", () => {
    expect(startNote(trends, "2023-10-10T08:12:31.000Z")).toBe(
      "The series starts in Jan 2026, the month of the oldest commit it reads: the first-parent chain of HEAD and the histories that merges absorbed begin there. The repository's first commit is from Oct 2023.",
    );
  });

  it("says nothing when the series starts with the repository", () => {
    expect(startNote(trends, "2026-01-05T00:00:00.000Z")).toBeNull();
    expect(startNote(trends, "2026-03-01T00:00:00.000Z")).toBeNull();
  });

  it("says nothing without a first commit or without months", () => {
    expect(startNote(trends, null)).toBeNull();
    expect(
      startNote({ ...trends, months: [] }, "2023-10-10T00:00:00.000Z"),
    ).toBeNull();
  });
});

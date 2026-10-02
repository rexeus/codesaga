import { describe, expect, it } from "vitest";

import { sampleBlock } from "../testing/reports.js";
import {
  changeView,
  complexityHistogram,
  lengthHistogram,
  testFunctionsLine,
  topFunctionRows,
} from "./typescript-functions.js";

const functions = sampleBlock("functions");
const change = sampleBlock("complexityAndChange");

describe("complexityHistogram", () => {
  it("counts functions by band and names the hardest one", () => {
    expect(complexityHistogram(functions)).toMatchObject({
      title: "Cognitive complexity of functions",
      noun: "functions",
      bins: [
        { label: "0–4", files: 1403 },
        { label: "5–9", files: 312 },
        { label: "10–14", files: 78 },
        { label: "15–24", files: 36 },
        { label: "25+", files: 11 },
      ],
      facts: [
        { value: "1", label: "median function" },
        { value: "6", label: "p90" },
        { value: "41", label: "hardest" },
      ],
      named: {
        path: "packages/api/src/billing/reconcile.ts",
        name: "billing/reconcile.ts:88",
        note: "hardest function, reconcileInvoices",
      },
      annotateAll: true,
    });
  });

  it("names an anonymous function as such", () => {
    const view = complexityHistogram({
      ...functions,
      production: {
        ...functions.production,
        top: [
          {
            name: "(anonymous) > (anonymous)",
            path: "a/b.ts",
            line: 3,
            complexity: 9,
            lines: 20,
          },
        ],
      },
    });

    expect(view.named?.note).toBe("hardest function, anonymous");
  });

  it("names none when there is no function", () => {
    const view = complexityHistogram({
      ...functions,
      production: { ...functions.production, functions: 0, top: [] },
    });

    expect(view.named).toBeNull();
  });
});

describe("lengthHistogram", () => {
  it("counts functions by length and states the shapes that are easy to count", () => {
    expect(lengthHistogram(functions)).toMatchObject({
      bins: [
        { label: "1–15", files: 1210 },
        { label: "16–30", files: 402 },
        { label: "31–60", files: 168 },
        { label: "61+", files: 60 },
      ],
      facts: [
        { value: "23", label: "with more than 4 parameters" },
        { value: "7", label: "deepest nesting" },
        { value: "8%", label: "of lines in functions scoring 15+" },
      ],
    });
  });
});

describe("topFunctionRows", () => {
  it("sizes each function against the hardest", () => {
    const rows = topFunctionRows(functions);

    expect(rows[0]).toEqual({
      name: "reconcileInvoices",
      anonymous: false,
      place: "billing/reconcile.ts:88",
      path: "packages/api/src/billing/reconcile.ts",
      complexity: "41",
      lines: "212 lines",
      fraction: 1,
    });
    // 33 of 41
    expect(rows[1]?.fraction).toBeCloseTo(33 / 41, 6);
  });

  it("marks a callback", () => {
    const rows = topFunctionRows({
      ...functions,
      production: {
        ...functions.production,
        top: [
          {
            name: "(anonymous)",
            path: "a.ts",
            line: 1,
            complexity: 5,
            lines: 9,
          },
        ],
      },
    });

    expect(rows[0]).toMatchObject({ anonymous: true, lines: "9 lines" });
  });
});

describe("testFunctionsLine", () => {
  it("sums up the tests' functions", () => {
    expect(testFunctionsLine(functions)).toBe(
      "Test code: 1,260 functions, 3 scoring 15 or more, hardest 17.",
    );
  });

  it("says none when no test function scores 15", () => {
    const line = testFunctionsLine({
      ...functions,
      tests: {
        ...functions.tests,
        over15: { ...functions.tests.over15, functions: 0 },
      },
    });

    expect(line).toContain("none scoring 15 or more");
  });

  it("is null without test functions", () => {
    expect(
      testFunctionsLine({
        ...functions,
        tests: { ...functions.tests, functions: 0 },
      }),
    ).toBeNull();
  });
});

describe("changeView", () => {
  it("frames the hotspots with the share of revisions in complex files", () => {
    const view = changeView(change);

    // 19 of 255 files hold a function scoring 15 or more
    expect(view.summary).toBe(
      "19 of 255 files hold a function scoring 15 or more; 13% of the revisions landed in them.",
    );
    expect(view.hotspots[0]).toEqual({
      name: "billing/reconcile.ts",
      path: "packages/api/src/billing/reconcile.ts",
      complexity: "41",
      revisions: "38",
      fraction: 1,
    });
    expect(view.shallow).toBe(false);
  });

  it("flags a shallow clone", () => {
    expect(changeView({ ...change, shallow: true }).shallow).toBe(true);
  });

  it("lists no hotspot when none qualifies", () => {
    expect(changeView({ ...change, hotspots: [] }).hotspots).toEqual([]);
  });
});

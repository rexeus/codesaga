import { describe, expect, it } from "vitest";

import { sampleBlock } from "../testing/reports.js";
import { testsTeaser, testsView } from "./typescript-tests.js";

const tests = sampleBlock("tests");

describe("testsView", () => {
  it("names the cases, the files and the frameworks", () => {
    const view = testsView(tests);

    expect(view.headline).toBe("1,420 cases in 76 files");
    expect(view.frameworks).toBe("Vitest");
  });

  it("splits the cases by how many direct assertions they make", () => {
    // 88, 502, 610 and 216 of 1,416 cases that have a body
    expect(testsView(tests).assertionSegments).toEqual([
      { label: "none", count: 88, share: "6%", entity: "slot-other" },
      { label: "1", count: 502, share: "35%", entity: "slot-1" },
      { label: "2–3", count: 610, share: "43%", entity: "slot-3" },
      { label: "4 or more", count: 216, share: "15%", entity: "slot-7" },
    ]);
  });

  it("counts how the cases are marked, zero included", () => {
    expect(testsView(tests).marks).toEqual([
      { label: "Parameterized (each)", count: "38" },
      { label: "Skipped", count: "9" },
      { label: "Focused (only)", count: "0" },
      { label: "Todo", count: "4" },
      { label: "Snapshot checks", count: "31" },
      { label: "Type tests", count: "12" },
    ]);
  });
});

describe("testsView focused markers", () => {
  it("lists the files that hold a focused marker", () => {
    const view = testsView({
      ...tests,
      focused: 1,
      focusedFiles: ["packages/api/test/orders.test.ts"],
    });

    expect(view.focusedFiles).toEqual(["packages/api/test/orders.test.ts"]);
  });

  it("counts the files that hold a focused marker beyond those listed", () => {
    const listed = ["a.test.ts", "b.test.ts"];

    expect(
      testsView({
        ...tests,
        focused: 9,
        focusedFiles: listed,
        focusedFileCount: 7,
      }).focusedMore,
    ).toBe("and 5 more files");
    expect(
      testsView({
        ...tests,
        focused: 2,
        focusedFiles: listed,
        focusedFileCount: 2,
      }).focusedMore,
    ).toBeNull();
  });

  it("does not guess a framework", () => {
    expect(testsView({ ...tests, frameworks: [] }).frameworks).toBe(
      "No test framework detected",
    );
  });

  it("does not divide by no cases", () => {
    const view = testsView({ ...tests, cases: 0, assertions: [0, 0, 0, 0] });

    expect(view.assertionSegments.map(({ share }) => share)).toEqual([
      "0%",
      "0%",
      "0%",
      "0%",
    ]);
  });
});

describe("testsTeaser", () => {
  it("counts the files and cases and names what is marked", () => {
    expect(testsTeaser(tests)).toBe("76 files · 1,420 cases · 9 skipped");
    expect(testsTeaser({ ...tests, focused: 2 })).toBe(
      "76 files · 1,420 cases · 9 skipped · 2 focused",
    );
  });

  it("names nothing marked when nothing is", () => {
    expect(testsTeaser({ ...tests, skipped: 0 })).toBe(
      "76 files · 1,420 cases",
    );
  });
});

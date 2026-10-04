import { describe, expect, it } from "vitest";

import { sampleBlock } from "../testing/reports.js";
import {
  counterpartRows,
  escapeSets,
  kindRows,
} from "./typescript-type-safety.js";

const typeSafety = sampleBlock("typeSafety");

describe("escapeSets", () => {
  it("shows production code first with its rate and the files that have an escape", () => {
    const [production] = escapeSets(typeSafety);

    // 191 sites in 38,400 lines of 262 files; 121 files have one
    expect(production).toMatchObject({
      label: "Production code",
      rate: "5.0",
      caption: "191 sites in 38,400 lines of 262 files",
      fileShare: "46% of the files have one",
    });
  });

  it("splits the sites into kinds that add up to the escapes", () => {
    const [production] = escapeSets(typeSafety);

    expect(
      production?.segments.map(({ label, count }) => [label, count]),
    ).toEqual([
      ["Explicit any", 21],
      ["Type assertions", 112],
      ["Non-null assertions", 27],
      ["@ts-expect-error", 5],
      ["@ts-ignore", 3],
      ["@ts-nocheck", 1],
      ["Lint disables", 22],
    ]);
    expect(
      production?.segments.reduce((sum, { count }) => sum + count, 0),
    ).toBe(typeSafety.production.escapes);
  });

  it("sets the tests apart", () => {
    const sets = escapeSets(typeSafety);

    expect(sets.map(({ label }) => label)).toEqual([
      "Production code",
      "Tests",
    ]);
    expect(sets[1]).toMatchObject({
      rate: "21.2",
      fileShare: "63% of the files have one",
    });
  });

  it("leaves out a set with no file", () => {
    const sets = escapeSets({
      ...typeSafety,
      tests: { ...typeSafety.tests, files: 0, lines: 0, escapes: 0 },
    });

    expect(sets.map(({ label }) => label)).toEqual(["Production code"]);
  });
});

describe("kindRows", () => {
  it("gives each kind its count and rate in production code and its rate in tests", () => {
    const rows = kindRows(typeSafety);

    expect(rows[1]).toMatchObject({
      label: "Type assertions",
      production: { count: "112", rate: "2.9" },
      tests: { count: "196", rate: "16.2" },
    });
    // 0.026 per 1,000 is not zero
    expect(rows[5]?.production).toEqual({ count: "1", rate: "<0.1" });
  });

  it("has no test cells without test files", () => {
    const rows = kindRows({
      ...typeSafety,
      tests: { ...typeSafety.tests, files: 0 },
    });

    expect(rows.every(({ tests }) => tests === null)).toBe(true);
  });
});

describe("counterpartRows", () => {
  it("lists the counts that overlap with the escapes, for production code", () => {
    const rows = counterpartRows(typeSafety);

    expect(rows.map(({ label, cell }) => [label, cell.count])).toEqual([
      ["unknown", "96"],
      ["satisfies", "34"],
      ["Type predicates", "12"],
      ["any keywords", "41"],
      ["as any", "9"],
      ["as unknown as T", "6"],
      ["any with no better type", "6"],
    ]);
  });
});

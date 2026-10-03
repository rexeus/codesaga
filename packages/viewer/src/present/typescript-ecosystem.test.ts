import { describe, expect, it } from "vitest";

import { sampleBlock } from "../testing/reports.js";
import {
  ecosystemFacts,
  ecosystemTeaser,
  importedRows,
  toolGroups,
} from "./typescript-ecosystem.js";

const ecosystem = sampleBlock("ecosystem");

describe("toolGroups", () => {
  it("groups the tools by category in a fixed order", () => {
    expect(toolGroups(ecosystem).map(({ label }) => label)).toEqual([
      "Frameworks",
      "Data",
      "Validation",
      "Testing",
      "Lint",
      "Format",
      "Monorepo",
    ]);
  });

  it("says how many files import a tool, and when only a manifest declares it", () => {
    const groups = toolGroups(ecosystem);

    expect(groups[0]?.tools).toEqual([
      { name: "React", detail: "141 files" },
      { name: "Next.js", detail: "58 files" },
    ]);
    expect(groups.find(({ label }) => label === "Lint")?.tools).toEqual([
      { name: "ESLint", detail: "declared only" },
    ]);
  });

  it("has no group without a tool", () => {
    expect(toolGroups({ ...ecosystem, tools: [] })).toEqual([]);
  });
});

describe("importedRows", () => {
  it("sizes each package against the most imported one", () => {
    const rows = importedRows(ecosystem.packages);

    expect(rows[0]).toEqual({ name: "react", files: "141", fraction: 1 });
    expect(rows[1]?.fraction).toBeCloseTo(58 / 141, 6);
  });

  it("has no rows for no imports", () => {
    expect(importedRows([])).toEqual([]);
  });
});

describe("ecosystemFacts", () => {
  it("counts the manifests' dependencies, the hook calls and the undeclared specifiers", () => {
    expect(ecosystemFacts(ecosystem)).toEqual([
      "11 package.json files declare 38 runtime and 41 development dependencies.",
      "412 hook calls (functions named use…) in 97 files.",
      "23 bare specifiers no manifest declares: path aliases, or dependencies declared outside the analyzed files.",
    ]);
  });

  it("leaves out what is not there", () => {
    const facts = ecosystemFacts({
      ...ecosystem,
      dependencies: { manifests: 0, runtime: 0, dev: 0 },
      hooks: { calls: 0, files: 0 },
      undeclared: 0,
    });

    expect(facts).toEqual(["No package.json was read."]);
  });
});

describe("ecosystemTeaser", () => {
  it("names the first three tools and counts the rest", () => {
    expect(ecosystemTeaser(ecosystem)).toBe(
      "React, Next.js, Vitest and 5 more",
    );
  });

  it("says when no tool of the table was detected", () => {
    expect(ecosystemTeaser({ ...ecosystem, tools: [] })).toBe(
      "No known tool detected",
    );
  });
});

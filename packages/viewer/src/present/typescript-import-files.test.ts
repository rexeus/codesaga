import { describe, expect, it } from "vitest";

import { firstOf, sampleBlock } from "../testing/reports.js";
import { importFilesView } from "./typescript-import-files.js";

const imports = sampleBlock("imports");

const withCycles = (cycles: typeof imports.files.cycles) => ({
  ...imports,
  files: { ...imports.files, cycles },
});

describe("importFilesView", () => {
  it("sums up the graph: its files, imports, median fan-in and outside imports", () => {
    expect(importFilesView(imports).facts).toEqual([
      { value: "267", label: "production files in the graph" },
      { value: "760", label: "imports between them, 148 types only" },
      { value: "1", label: "median files importing a file" },
      { value: "1,184", label: "imports of outside packages and built-ins" },
    ]);
  });

  it("sizes the most imported files against the first", () => {
    const [first, second] = importFilesView(imports).fanIn;

    expect(first).toEqual({
      name: "src/cn.ts",
      path: "packages/ui/src/cn.ts",
      count: "74",
      fraction: 1,
    });
    expect(second?.fraction).toBeCloseTo(41 / 74, 6);
  });
});

describe("importFilesView cycles", () => {
  it("tells the cycles of values from those that exist only through types", () => {
    const view = importFilesView(imports);

    expect(view.cycleSummary).toBe(
      "3 cycles between production files, the largest of 5 files. With type-only imports counted there are 4, the largest of 9 files; 1 exists only through types, which cost nothing at runtime.",
    );
    expect(view.cycles[0]).toMatchObject({
      title: "5 files in 1 territory",
      more: null,
    });
  });

  it("says when a cycle has more files than the report lists", () => {
    const cycle = firstOf(imports.files.cycles.top);

    const view = importFilesView(
      withCycles({ ...imports.files.cycles, top: [{ ...cycle, size: 17 }] }),
    );

    expect(view.cycles[0]?.more).toBe("and 12 more");
  });

  it("says there is no cycle", () => {
    const view = importFilesView(
      withCycles({
        count: 0,
        largest: 0,
        top: [],
        withTypes: { count: 0, largest: 0 },
        typeOnly: 0,
      }),
    );

    expect(view.cycleSummary).toBe("No cycle between production files.");
    expect(view.cycles).toEqual([]);
  });
});

describe("importFilesView specifiers", () => {
  it("names the specifiers that found no file", () => {
    const view = importFilesView(imports);

    expect(view.unresolvedSummary).toBe(
      "14 specifiers into the repository found no file, 0.7% of those.",
    );
    expect(view.unresolved[0]).toEqual({
      specifier: "@aurora/ui/generated",
      files: "6 files",
    });
  });

  it("has no line on specifiers when every one was found", () => {
    const view = importFilesView({
      ...imports,
      files: { ...imports.files, unresolved: { count: 0, share: 0, top: [] } },
    });

    expect(view.unresolvedSummary).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { languageEntities } from "./languages.js";
import { territoryStats } from "./territory-stats.js";

const report = sampleReport();
const db = report.knowledge.territories.territories.find(
  ({ path }) => path === "packages/db",
);
if (db === undefined) {
  throw new Error("the sample report has no packages/db territory");
}
const view = territoryStats(
  db.stats,
  report.stats,
  languageEntities(report.overview.languages),
);

describe("territoryStats", () => {
  it("words the size and the length of its files", () => {
    expect([view.files, view.lines]).toEqual(["52", "5,913"]);
    expect(view.fileLength).toMatchObject({
      min: "5",
      median: "85",
      max: "455",
    });
  });

  it("shares the test files and lines out of the territory's own", () => {
    // 8 of 52 files, 910 of 5,913 lines
    expect(view.tests.share).toBe("15%");
    expect(view.tests.caption).toBe(
      "8 of 52 files are tests, 15% of the lines",
    );
    expect([view.tests.files, view.tests.otherFiles]).toEqual([8, 44]);
  });

  it("holds churn and complexity against the repository's and names the most changed and the deepest file", () => {
    expect(view.churn).toMatchObject({
      figure: "5",
      p90: "20",
      mostChanged: {
        name: "db/file1.ts",
        path: "packages/db/file1.ts",
        revisions: "44",
      },
    });
    expect(view.complexity).toMatchObject({
      figure: "1.30",
      medianFile: "1.17",
      deepest: { name: "db/handler.ts", perLine: "2.80" },
    });
    // 1.3 against the repository's 1.7, on a bar that ends at 1.7 * 1.12
    expect(view.complexity.comparison.value).toBeCloseTo(0.6828, 4);
    expect(view.complexity.comparison.reference).toBeCloseTo(0.8929, 4);
  });

  it("describes the style and keeps the repository's color for a language", () => {
    expect(view.style.indentation.headline).toBe("2 spaces");
    expect(view.style.lineLength).toEqual({ median: "33", p90: "72" });
    expect(view.style.comments).toBe("8%");
    expect(view.languages.map(({ name, entity }) => [name, entity])).toEqual([
      ["TypeScript", "slot-1"],
    ]);
  });
});

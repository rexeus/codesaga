import { describe, expect, it } from "vitest";

import { samplePullRequests } from "../testing/sample-pull-requests.js";
import { sampleReport } from "../testing/sample-report.js";
import { limitReport } from "./limit-report.js";

describe("limitReport", () => {
  it("cuts the contributors to the limit and keeps their order", () => {
    const report = sampleReport();

    const limited = limitReport(report, 3);

    expect(limited.contributors).toStrictEqual(report.contributors.slice(0, 3));
  });

  it("cuts the knowledge directories to the limit and keeps their risk order", () => {
    const report = sampleReport();

    const limited = limitReport(report, 3);

    expect(limited.knowledge.directories).toStrictEqual(
      report.knowledge.directories.slice(0, 3),
    );
    expect(limited.totals.directories).toBe(8);
  });

  it("keeps the totals and the time series of the untruncated report", () => {
    const report = sampleReport();

    const limited = limitReport(report, 3);

    expect(limited.totals).toStrictEqual(report.totals);
    expect(limited.activity.weeks).toHaveLength(report.activity.weeks.length);
  });

  it("keeps everything when the limit is 0 or exceeds the lists", () => {
    const report = sampleReport();

    expect(limitReport(report, 0)).toStrictEqual(report);
    expect(limitReport(report, 100)).toStrictEqual(report);
  });

  it("cuts the pull request authors and reviewers to the limit and keeps their sizes", () => {
    const pullRequests = samplePullRequests();
    const report = { ...sampleReport(), pullRequests };

    const limited = limitReport(report, 2);

    expect(limited.pullRequests?.authors).toStrictEqual(
      pullRequests.authors.slice(0, 2),
    );
    expect(limited.pullRequests?.reviewers).toStrictEqual(
      pullRequests.reviewers.slice(0, 2),
    );
    expect(limited.pullRequests?.totals).toStrictEqual({
      authors: 6,
      reviewers: 6,
    });
    expect(limited.pullRequests?.months).toStrictEqual(pullRequests.months);
  });
});

describe("limitReport territories", () => {
  it("cuts the first cut and the territories inside each one to the limit and keeps every total", () => {
    const report = sampleReport();

    const limited = limitReport(report, 2).knowledge.territories;

    expect(limited.totalTerritories).toBe(11);
    expect(limited.territories.map(({ path }) => path)).toStrictEqual([
      "docs",
      "packages/db",
    ]);
    const db = limited.territories[1];
    expect(db?.totalTerritories).toBe(3);
    expect(db?.territories.map(({ path }) => path)).toStrictEqual([
      "packages/db/migrations",
      "packages/db/src",
    ]);
    expect(db?.territories[1]?.totalTerritories).toBe(2);
    expect(limited.detail).toBe(report.knowledge.territories.detail);
  });
});

/** The sample report with three focused test files, which the sample itself has none of. */
const withFocusedFiles = () => {
  const report = sampleReport();
  const typescript = report.deepDives?.typescript;
  if (typescript?.tests === undefined) {
    throw new Error("the sample report has no tests block");
  }
  const focusedFiles = ["a.test.ts", "b.test.ts", "c.test.ts"];
  return {
    ...report,
    deepDives: {
      typescript: {
        ...typescript,
        tests: { ...typescript.tests, focusedFiles },
      },
    },
  };
};

describe("limitReport deep dives", () => {
  it("cuts the tsconfig postures to the limit and keeps their number", () => {
    const report = sampleReport();
    const configs = report.deepDives?.typescript?.strictness?.configs ?? [];

    const strictness = limitReport(report, 2).deepDives?.typescript?.strictness;

    expect(strictness?.configs).toStrictEqual(configs.slice(0, 2));
    expect(strictness?.totalConfigs).toBe(configs.length);
  });

  it("cuts the hardest functions, the hotspot files and the focused test files to the limit", () => {
    const limited = limitReport(withFocusedFiles(), 2).deepDives?.typescript;

    expect([
      limited?.functions?.production.top.map(({ name }) => name),
      limited?.functions?.tests.top.length,
      limited?.complexityAndChange?.hotspots.map(({ path }) => path),
      limited?.tests?.focusedFiles,
      limited?.functions?.production.functions,
    ]).toStrictEqual([
      ["reconcileInvoices", "buildQuery"],
      2,
      [
        "packages/api/src/billing/reconcile.ts",
        "packages/db/src/query/build.ts",
      ],
      ["a.test.ts", "b.test.ts"],
      1840,
    ]);
  });

  it("leaves a report without deep dives alone", () => {
    const { deepDives: _deepDives, ...report } = sampleReport();

    expect(limitReport(report, 2)).not.toHaveProperty("deepDives");
  });
});

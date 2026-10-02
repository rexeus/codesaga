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
  it("cuts the territories of every detail to the limit and keeps each detail's total", () => {
    const report = sampleReport();

    const limited = limitReport(report, 3).knowledge.territories;
    const original = report.knowledge.territories;
    expect(
      limited.details.map(({ totalTerritories, territories }) => [
        totalTerritories,
        territories.length,
      ]),
    ).toStrictEqual([
      [11, 3],
      [27, 3],
      [41, 3],
    ]);
    expect(limited.details[0]?.territories).toStrictEqual(
      original.details[0]?.territories.slice(0, 3),
    );
    expect(limited.detail).toBe(original.detail);
  });
});

import { describe, expect, it } from "vitest";

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
});

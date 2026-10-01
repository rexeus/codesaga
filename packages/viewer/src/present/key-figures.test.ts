import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { keyFigures } from "./key-figures.js";

const deltasByLabel = (report: Report): Record<string, string | undefined> =>
  Object.fromEntries(keyFigures(report).map((f) => [f.label, f.delta]));

const valuesByLabel = (report = sampleReport()): Record<string, string> =>
  Object.fromEntries(keyFigures(report).map((f) => [f.label, f.value]));

describe("keyFigures", () => {
  it("reads every tile from the report", () => {
    expect(valuesByLabel()).toEqual({
      Age: "2y 11m",
      Commits: "2,246",
      "Active contributors": "3",
      "Truck factor": "2",
      // (203 agent-assisted + 111 agent) of 2246 commits
      "AI share": "14%",
      "Lines of code": "60,942",
    });
  });

  it("shows a dash instead of a share or age it cannot compute", () => {
    const report = sampleReport();
    const empty = {
      ...report,
      repository: { ...report.repository, firstCommitAt: null },
      window: { ...report.window, commits: 0 },
    };

    const values = valuesByLabel(empty);

    expect(values["Age"]).toBe("–");
    expect(values["AI share"]).toBe("–");
  });
});

describe("keyFigures deltas", () => {
  const figures = {
    commits: 100,
    activeContributors: 4,
    added: 0,
    deleted: 0,
    automation: { human: 100, agentAssisted: 0, agent: 0, bot: 0 },
    aiShare: 0,
  };
  const compared = (
    delta: NonNullable<Report["comparison"]>["delta"],
  ): Report => ({
    ...sampleReport(),
    comparison: {
      previous: {
        since: "2025-10-15T00:00:00.000Z",
        until: "2026-01-15T00:00:00.000Z",
        ...figures,
      },
      current: figures,
      delta,
    },
  });
  const unchanged = { change: 0, ratio: 0 };

  it("names the change of commits, contributors and AI share against the previous period", () => {
    const report = compared({
      commits: { change: 18, ratio: 0.183 },
      activeContributors: { change: -2, ratio: -0.25 },
      added: unchanged,
      deleted: unchanged,
      aiShare: 0.044,
    });

    expect(deltasByLabel(report)).toStrictEqual({
      Age: undefined,
      Commits: "+18% vs previous period",
      "Active contributors":
        "\u22122 contributors in window vs previous period",
      "Truck factor": undefined,
      "AI share": "+4 pts vs previous period",
      "Lines of code": undefined,
    });
  });

  it("shows the count when the previous period had no commits to relate to", () => {
    const report = compared({
      commits: { change: 18, ratio: null },
      activeContributors: unchanged,
      added: unchanged,
      deleted: unchanged,
      aiShare: 0,
    });

    expect(deltasByLabel(report)["Commits"]).toBe("+18 vs previous period");
    expect(deltasByLabel(report)["AI share"]).toBe("0 pts vs previous period");
  });

  it("has no deltas without a comparison", () => {
    expect(Object.values(deltasByLabel(sampleReport()))).toStrictEqual(
      Array.from({ length: 6 }, () => undefined),
    );
  });
});

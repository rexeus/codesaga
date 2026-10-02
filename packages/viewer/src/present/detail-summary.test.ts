import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { detailStatus, detailTicks } from "./detail-slider.js";
import { detailSummary, dormantLegend } from "./detail-summary.js";

type Territory = Report["knowledge"]["territories"]["territories"][number];

const stats = sampleReport().stats;

const territory = (overrides: Partial<Territory>): Territory => ({
  path: "packages/db",
  files: 20,
  truckFactor: 3,
  island: false,
  orphaned: false,
  experts: [],
  reasons: [],
  kind: "package",
  lastChangedAt: "2026-08-14T08:00:00.000Z",
  stats,
  badges: [],
  totalTerritories: 0,
  territories: [],
  ...overrides,
});

const detail = (
  at: number,
  territories: Territory[],
  totalTerritories = territories.length,
) => ({ detail: at, totalTerritories, territories });

describe("detailSummary", () => {
  it("counts the territories, their files and the risky ones", () => {
    const summary = detailSummary(
      detail(1, [
        territory({ files: 30, truckFactor: 1, island: true }),
        territory({ files: 20, truckFactor: 2, orphaned: true }),
        territory({ files: 10, truckFactor: 5 }),
      ]),
      80,
    );

    expect(summary).toEqual({
      territories: 3,
      otherGroups: 0,
      coveredFiles: 60,
      totalFiles: 80,
      lowTruckFactor: 2,
      islands: 1,
      orphaned: 1,
      truncated: null,
    });
  });

  it("counts territories without the groups of other files, as the engine's recommendation does", () => {
    const detailWithOtherFiles = detail(1, [
      territory({ files: 30 }),
      territory({ path: "src", kind: "folder", files: 20 }),
      territory({ path: "src", kind: "other", files: 4 }),
    ]);

    expect(detailSummary(detailWithOtherFiles, 80)).toMatchObject({
      territories: 2,
      otherGroups: 1,
    });
    expect(detailStatus(detailWithOtherFiles)).toBe(
      "2 non-overlapping territories",
    );
    expect(
      detailTicks({
        detail: 1,
        recommendedDetail: 1,
        reason:
          "detail 1: 2 territories (without other files) for 3 active contributors",
        details: [detailWithOtherFiles],
      })[0]?.count,
    ).toBe("2 territories");
  });

  it("says so when the report's limit cut territories off", () => {
    const summary = detailSummary(detail(1, [territory({})], 40), 80);

    expect(summary.truncated).toBe(
      "Showing the 1 riskiest of 40 territories: the report was limited.",
    );
  });
});

describe("dormantLegend", () => {
  it("names the months after which an expert is dormant", () => {
    expect(dormantLegend(183)).toBe("Dormant for 6+ months");
  });
});

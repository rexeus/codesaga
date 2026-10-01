import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/sample-report.js";
import { evaluateGates } from "./evaluate-gates.js";
import type { GateLimits } from "./gate-limits.js";

type Measured = {
  readonly truckFactor?: number;
  /** One directory per entry: whether it is orphaned and whether it is an island. */
  readonly directories?: ReadonlyArray<"orphaned" | "island" | "healthy">;
  readonly automation?: Report["automation"]["totals"];
  readonly active90?: number;
};

const reportWith = (measured: Measured): Report => {
  const report = sampleReport();
  const [directory] = report.knowledge.directories;
  if (directory === undefined) {
    throw new Error("the sample report has no directory");
  }
  return {
    ...report,
    overview: {
      ...report.overview,
      contributors: {
        ...report.overview.contributors,
        active90: measured.active90 ?? 0,
      },
    },
    automation: {
      ...report.automation,
      totals: measured.automation ?? {
        human: 1,
        agentAssisted: 0,
        agent: 0,
        bot: 0,
      },
    },
    knowledge: {
      ...report.knowledge,
      truckFactor: {
        ...report.knowledge.truckFactor,
        value: measured.truckFactor ?? 0,
      },
      directories: (measured.directories ?? []).map((kind) =>
        Object.assign({}, directory, {
          orphaned: kind === "orphaned",
          island: kind === "island",
        }),
      ),
    },
  };
};

const unconfigured: GateLimits = {
  minTruckFactor: undefined,
  maxOrphanedDirectories: undefined,
  maxIslandDirectories: undefined,
  maxAgentShare: undefined,
  minActiveContributors: undefined,
};

const only = (limits: Partial<GateLimits>): GateLimits => ({
  ...unconfigured,
  ...limits,
});

describe("evaluateGates", () => {
  it("evaluates only the configured gates, in a fixed order", () => {
    const result = evaluateGates(
      reportWith({ truckFactor: 3, active90: 4 }),
      only({ minActiveContributors: 2, minTruckFactor: 3 }),
    );

    expect(result.gates.map((gate) => gate.name)).toStrictEqual([
      "minTruckFactor",
      "minActiveContributors",
    ]);
  });

  it("reports no gates and a pass when nothing is configured", () => {
    expect(evaluateGates(reportWith({}), unconfigured)).toStrictEqual({
      schemaVersion: 1,
      passed: true,
      gates: [],
    });
  });
});

describe("evaluateGates minimum gates", () => {
  it("passes a truck factor exactly at the minimum and fails one below it", () => {
    const atMinimum = evaluateGates(
      reportWith({ truckFactor: 2 }),
      only({ minTruckFactor: 2 }),
    );
    const below = evaluateGates(
      reportWith({ truckFactor: 1 }),
      only({ minTruckFactor: 2 }),
    );

    expect(atMinimum.gates).toStrictEqual([
      {
        name: "minTruckFactor",
        threshold: 2,
        actual: 2,
        passed: true,
        reason: "truck factor: 2, at least the minimum of 2",
      },
    ]);
    expect(below.gates).toStrictEqual([
      {
        name: "minTruckFactor",
        threshold: 2,
        actual: 1,
        passed: false,
        reason: "truck factor: 1, below the minimum of 2",
      },
    ]);
    expect(below.passed).toBe(false);
  });
});

describe("evaluateGates maximum gates", () => {
  it("counts only orphaned directories against the orphaned maximum", () => {
    const report = reportWith({
      directories: ["orphaned", "island", "orphaned", "healthy"],
    });

    const atMaximum = evaluateGates(
      report,
      only({ maxOrphanedDirectories: 2 }),
    );
    const above = evaluateGates(report, only({ maxOrphanedDirectories: 1 }));

    expect(atMaximum.gates[0]).toMatchObject({ actual: 2, passed: true });
    expect(above.gates[0]).toStrictEqual({
      name: "maxOrphanedDirectories",
      threshold: 1,
      actual: 2,
      passed: false,
      reason: "orphaned directories: 2, above the maximum of 1",
    });
  });

  it("counts only knowledge islands against the island maximum", () => {
    const report = reportWith({
      directories: ["island", "orphaned", "healthy"],
    });

    const atMaximum = evaluateGates(report, only({ maxIslandDirectories: 1 }));
    const above = evaluateGates(report, only({ maxIslandDirectories: 0 }));

    expect(atMaximum.gates[0]).toMatchObject({ actual: 1, passed: true });
    expect(above.gates[0]).toMatchObject({ actual: 1, passed: false });
  });

  it("measures the agent share as agent and agent-assisted commits of all window commits", () => {
    const report = reportWith({
      automation: { human: 5, agentAssisted: 1, agent: 1, bot: 1 },
    });

    const atMaximum = evaluateGates(report, only({ maxAgentShare: 0.25 }));
    const above = evaluateGates(report, only({ maxAgentShare: 0.24 }));

    expect(atMaximum.gates[0]).toStrictEqual({
      name: "maxAgentShare",
      threshold: 0.25,
      actual: 0.25,
      passed: true,
      reason:
        "agent and agent-assisted share of commits: 25%, within the maximum of 25%",
    });
    expect(above.gates[0]).toMatchObject({ actual: 0.25, passed: false });
  });

  it("rounds the agent share to 4 decimals before comparing it", () => {
    const report = reportWith({
      automation: { human: 2, agentAssisted: 1, agent: 0, bot: 0 },
    });

    const result = evaluateGates(report, only({ maxAgentShare: 0.3333 }));

    expect(result.gates[0]).toMatchObject({ actual: 0.3333, passed: true });
  });

  it("treats a window without commits as an agent share of 0", () => {
    const report = reportWith({
      automation: { human: 0, agentAssisted: 0, agent: 0, bot: 0 },
    });

    const result = evaluateGates(report, only({ maxAgentShare: 0 }));

    expect(result.gates[0]).toMatchObject({ actual: 0, passed: true });
  });
});

describe("evaluateGates active contributors", () => {
  it("passes active contributors exactly at the minimum and fails one below it", () => {
    const atMinimum = evaluateGates(
      reportWith({ active90: 3 }),
      only({ minActiveContributors: 3 }),
    );
    const below = evaluateGates(
      reportWith({ active90: 2 }),
      only({ minActiveContributors: 3 }),
    );

    expect(atMinimum.gates[0]).toMatchObject({ actual: 3, passed: true });
    expect(below.gates[0]).toStrictEqual({
      name: "minActiveContributors",
      threshold: 3,
      actual: 2,
      passed: false,
      reason: "contributors active in 90 days: 2, below the minimum of 3",
    });
  });

  it("fails the result when any one gate fails", () => {
    const result = evaluateGates(
      reportWith({ truckFactor: 3, active90: 1 }),
      only({ minTruckFactor: 3, minActiveContributors: 2 }),
    );

    expect(result.gates.map((gate) => gate.passed)).toStrictEqual([
      true,
      false,
    ]);
    expect(result.passed).toBe(false);
  });
});

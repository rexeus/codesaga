// Owns what each gate measures in a report and how a measurement meets its limit.
import type { Report } from "@codesaga/engine";

import type { CheckResult } from "./check-result.js";
import { GATE_NAMES } from "./gate-limits.js";
import type { GateLimits, GateName } from "./gate-limits.js";

type Gate = {
  /** `min` gates need at least the limit, `max` gates at most the limit. */
  readonly bound: "min" | "max";
  readonly subject: string;
  readonly measure: (report: Report) => number;
  readonly format: (value: number) => string;
};

const percent = (ratio: number): string =>
  `${Number((ratio * 100).toFixed(2))}%`;

const roundedRatio = (value: number): number =>
  Math.round(value * 10_000) / 10_000;

const directoriesWhere =
  (flag: "island" | "orphaned") =>
  (report: Report): number =>
    report.knowledge.directories.filter((directory) => directory[flag]).length;

const agentShare = ({ automation }: Report): number => {
  const { human, agentAssisted, agent, bot } = automation.totals;
  const commits = human + agentAssisted + agent + bot;
  return commits === 0 ? 0 : roundedRatio((agent + agentAssisted) / commits);
};

const GATES: Readonly<Record<GateName, Gate>> = {
  minTruckFactor: {
    bound: "min",
    subject: "truck factor",
    measure: (report) => report.knowledge.truckFactor.value,
    format: String,
  },
  maxOrphanedDirectories: {
    bound: "max",
    subject: "orphaned directories",
    measure: directoriesWhere("orphaned"),
    format: String,
  },
  maxIslandDirectories: {
    bound: "max",
    subject: "knowledge island directories",
    measure: directoriesWhere("island"),
    format: String,
  },
  maxAgentShare: {
    bound: "max",
    subject: "agent and agent-assisted share of commits",
    measure: agentShare,
    format: percent,
  },
  minActiveContributors: {
    bound: "min",
    subject: "contributors active in 90 days",
    measure: (report) => report.overview.contributors.active90,
    format: String,
  },
};

const reasonFor = (
  gate: Gate,
  actual: number,
  threshold: number,
  passed: boolean,
): string => {
  const comparison =
    gate.bound === "min"
      ? `${passed ? "at least" : "below"} the minimum of`
      : `${passed ? "within" : "above"} the maximum of`;
  return `${gate.subject}: ${gate.format(actual)}, ${comparison} ${gate.format(threshold)}`;
};

/**
 * Measures `report` against every configured limit, in the fixed order of
 * `GATE_NAMES`. A limit of `undefined` skips its gate. A measurement exactly
 * at its limit passes. The agent share counts agent and agent-assisted commits
 * of the window against all its commits, rounded to 4 decimals.
 */
export const evaluateGates = (
  report: Report,
  limits: GateLimits,
): CheckResult => {
  const gates = GATE_NAMES.flatMap((name) => {
    const threshold = limits[name];
    if (threshold === undefined) {
      return [];
    }
    const gate = GATES[name];
    const actual = gate.measure(report);
    const passed =
      gate.bound === "min" ? actual >= threshold : actual <= threshold;
    return [
      {
        name,
        threshold,
        actual,
        passed,
        reason: reasonFor(gate, actual, threshold, passed),
      },
    ];
  });
  return {
    schemaVersion: 1,
    passed: gates.every((gate) => gate.passed),
    gates,
  };
};

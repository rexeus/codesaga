import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { territoryDetails } from "./territory-details.js";

type Tree = Report["knowledge"]["territories"];
type Territory = Tree["territories"][number];

const stats = sampleReport().stats;

const territory = (
  path: string,
  overrides: Partial<Territory> = {},
): Territory => ({
  path,
  files: 10,
  truckFactor: 2,
  island: false,
  orphaned: false,
  experts: [],
  reasons: [],
  kind: "folder",
  lastChangedAt: "2026-08-14T08:00:00.000Z",
  stats,
  badges: [],
  totalTerritories: 0,
  territories: [],
  ...overrides,
});

const splitting = (
  path: string,
  splitDetail: number,
  territories: Territory[],
  total = territories.length,
): Territory =>
  territory(path, {
    kind: "package",
    splitDetail,
    splitReason: "big: 10 files",
    totalTerritories: total,
    territories,
  });

/** `a` splits at detail 2 into `a/x`, `a/y` and other files, and `a/y` splits at detail 3; `b` stays whole. */
const tree = (limited = false): Tree => ({
  detail: 2,
  recommendedDetail: 2,
  maxDetail: 3,
  reason:
    "detail 2: 3 territories (without other files) for 1 active contributor",
  totalTerritories: limited ? 5 : 2,
  territories: [
    splitting("a", 2, [
      territory("a/x"),
      splitting("a/y", 3, [territory("a/y/p"), territory("a/y/q")]),
      territory("a", { kind: "other" }),
    ]),
    territory("b"),
  ],
});

const pathsOf = (detail: { territories: ReadonlyArray<Territory> }) =>
  detail.territories.map(({ kind, path }) => `${kind} ${path}`);

describe("territoryDetails", () => {
  it("opens the splits whose detail has been reached and lists other files last", () => {
    const { details } = territoryDetails(tree());

    expect(details.map((detail) => pathsOf(detail))).toStrictEqual([
      ["package a", "folder b"],
      ["folder a/x", "package a/y", "folder b", "other a"],
      ["folder a/x", "folder a/y/p", "folder a/y/q", "folder b", "other a"],
    ]);
  });

  it("carries the report's detail, recommendation and reason", () => {
    expect(territoryDetails(tree())).toMatchObject({
      detail: 2,
      recommendedDetail: 2,
      reason:
        "detail 2: 3 territories (without other files) for 1 active contributor",
    });
  });

  it("adds the territories an output limit cut off to each detail's total", () => {
    const limited = tree(true);

    const { details } = territoryDetails({
      ...limited,
      territories: [
        splitting("a", 2, [territory("a/x")], 4),
        ...limited.territories.slice(1),
      ],
    });

    expect(
      details.map(({ totalTerritories }) => totalTerritories),
    ).toStrictEqual([5, 8, 8]);
  });
});

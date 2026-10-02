import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { insideOf, splitsAt, territoryKey, toggled } from "./territory-tree.js";

type Territory = Report["knowledge"]["territories"]["territories"][number];

const stats = sampleReport().stats;

const territory = (
  path: string,
  kind: Territory["kind"] = "folder",
  overrides: Partial<Territory> = {},
): Territory => ({
  path,
  files: 10,
  truckFactor: 2,
  island: false,
  orphaned: false,
  experts: [],
  reasons: [],
  kind,
  lastChangedAt: "2026-08-14T08:00:00.000Z",
  stats,
  badges: [],
  totalTerritories: 0,
  territories: [],
  ...overrides,
});

const splitting = (
  children: Territory[],
  total = children.length,
  splitDetail = 2,
): Territory =>
  territory("packages/db", "package", {
    splitDetail,
    splitReason: "big: 10 files",
    totalTerritories: total,
    territories: children,
  });

describe("territoryKey", () => {
  it("tells a package from its other files, which share its path", () => {
    expect(territoryKey(territory("packages/db", "package"))).not.toBe(
      territoryKey(territory("packages/db", "other")),
    );
  });
});

describe("splitsAt", () => {
  it("opens a split from its detail on, and never for a territory that does not split", () => {
    const node = splitting([], 0, 3);

    expect([2, 3, 4].map((detail) => splitsAt(node, detail))).toEqual([
      false,
      true,
      true,
    ]);
    expect(splitsAt(territory("docs"), 6)).toBe(false);
  });
});

describe("insideOf", () => {
  it("counts the territories inside and names the first three, other files left out", () => {
    const inside = insideOf(
      splitting([
        territory("packages/db/a"),
        territory("packages/db/b"),
        territory("packages/db", "other"),
        territory("packages/db/c"),
        territory("packages/db/d"),
        territory("packages/db/e"),
      ]),
    );

    expect(inside).toEqual({ count: 6, names: ["a", "b", "c"], more: 2 });
  });

  it("counts the territories an output limit cut off, without chips for them", () => {
    const inside = insideOf(
      splitting(
        [territory("packages/db/a"), territory("packages/db", "other")],
        9,
      ),
    );

    expect(inside).toEqual({ count: 9, names: ["a"], more: 7 });
  });

  it("has nothing inside a territory that does not split", () => {
    expect(insideOf(territory("docs"))).toBeNull();
  });
});

describe("toggled", () => {
  it("adds a key that is missing and removes one that is there, leaving the original alone", () => {
    const keys: ReadonlySet<string> = new Set(["folder:a"]);

    expect([...toggled(keys, "folder:b")]).toEqual(["folder:a", "folder:b"]);
    expect([...toggled(keys, "folder:a")]).toEqual([]);
    expect([...keys]).toEqual(["folder:a"]);
  });
});

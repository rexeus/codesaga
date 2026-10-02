import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import type { ClassifiedCommit } from "../automation/classify.js";
import { at, classifiedCommit } from "../testing/classified-commit.js";
import { knowledge } from "./knowledge.js";

const now = DateTime.makeUnsafe("2026-03-01T00:00:00Z");
const ada = { name: "Ada", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };
const linus = { name: "Linus", email: "linus@example.com" };

const filesIn = (directory: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `${directory}/f${index}.ts`);

// 16 files in 4 packages: level 1 has 4 viable areas, level 2 has 5, then nothing changes.
const paths = [
  "apps/web/index.ts",
  ...filesIn("apps/web/src", 3),
  ...filesIn("packages/lib/a", 3),
  ...filesIn("packages/lib/b", 3),
  ...filesIn("packages/cli", 3),
  ...filesIn("packages/api", 3),
];
const packageRoots = [
  "apps/web",
  "packages/api",
  "packages/cli",
  "packages/lib",
];

const commit = (
  time: string,
  author: ClassifiedCommit["author"],
): ClassifiedCommit =>
  classifiedCommit({
    time: at(time),
    author,
    changes: paths.map((path) => ({ path, added: 10, deleted: 0 })),
  });

const areasOf = (commits: ReadonlyArray<ClassifiedCommit>, depth?: number) =>
  knowledge({
    commits,
    universe: paths.map((path) => ({ path, loc: 50 })),
    scope: ".",
    packageRoots,
    depth,
    window: {
      since: "2026-01-01T00:00:00.000Z",
      until: "2026-03-01T00:00:00.000Z",
    },
    headTime: at("2026-02-01T00:00:00Z"),
    now,
  }).section.areas;

const threeActive = [
  commit("2026-02-20T00:00:00Z", ada),
  commit("2026-02-19T00:00:00Z", grace),
  commit("2026-02-18T00:00:00Z", linus),
];

describe("knowledge areas", () => {
  it("recommends the level with about two areas per contributor active in 90 days", () => {
    // 3 active contributors: target 6; level 1 has 4 viable areas, level 2 has 5
    const areas = areasOf(threeActive);

    expect(areas).toMatchObject({
      depth: 2,
      recommendedDepth: 2,
      reason: "level 2: 5 areas with 3+ files for 3 active contributors",
    });
    expect(areas.levels.map(({ depth }) => depth)).toStrictEqual([1, 2]);
  });

  it("does not count contributors whose last commit is older than 90 days", () => {
    // 1 active contributor: target 4, which level 1 meets
    const areas = areasOf([
      commit("2026-02-20T00:00:00Z", ada),
      commit("2025-06-01T00:00:00Z", grace),
      commit("2025-06-02T00:00:00Z", linus),
    ]);

    expect(areas).toMatchObject({
      recommendedDepth: 1,
      reason: "level 1: 4 areas with 3+ files for 1 active contributor",
    });
  });

  it("sizes the target by every contributor when nobody is active", () => {
    const areas = areasOf([
      commit("2025-06-03T00:00:00Z", ada),
      commit("2025-06-02T00:00:00Z", grace),
      commit("2025-06-01T00:00:00Z", linus),
    ]);

    expect(areas.reason).toBe(
      "level 2: 5 areas with 3+ files for 3 contributors",
    );
  });

  it("starts at the requested depth and still reports the recommendation", () => {
    expect(areasOf(threeActive, 1)).toMatchObject({
      depth: 1,
      recommendedDepth: 2,
    });
  });

  it("starts at the deepest level when the requested depth is beyond it", () => {
    expect(areasOf(threeActive, 9)).toMatchObject({
      depth: 2,
      recommendedDepth: 2,
    });
  });

  it.each([0, 0.5, -3, Number.NaN, Number.POSITIVE_INFINITY])(
    "starts at the recommended level for the requested depth %s",
    (depth) => {
      expect(areasOf(threeActive, depth).depth).toBe(2);
    },
  );

  it("rounds a fractional depth down", () => {
    expect(areasOf(threeActive, 1.9).depth).toBe(1);
  });
});

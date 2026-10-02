import { describe, expect, it } from "vitest";

import { recommendDepth } from "./recommended-depth.js";

const levelsOf = (...viableAreas: ReadonlyArray<number>) =>
  viableAreas.map((count, index) => ({
    depth: index + 1,
    viableAreas: count,
  }));

describe("recommendDepth", () => {
  it("aims at two areas per active contributor and states the choice", () => {
    // 6 active contributors: target 12; |4-12|=8, |11-12|=1, |20-12|=8
    expect(
      recommendDepth({
        levels: levelsOf(4, 11, 20),
        activeContributors: 6,
        historyContributors: 30,
      }),
    ).toStrictEqual({
      depth: 2,
      reason: "level 2: 11 areas for 6 active contributors",
    });
  });

  it("clamps the target to 4 areas for a single contributor", () => {
    // target 2 becomes 4; |3-4|=1, |6-4|=2
    expect(
      recommendDepth({
        levels: levelsOf(3, 6),
        activeContributors: 1,
        historyContributors: 1,
      }).depth,
    ).toBe(1);
  });
});

describe("recommendDepth targets", () => {
  it("clamps the target to 25 areas for a large team", () => {
    // target 80 becomes 25; |10-25|=15, |24-25|=1, |60-25|=35
    expect(
      recommendDepth({
        levels: levelsOf(10, 24, 60),
        activeContributors: 40,
        historyContributors: 90,
      }).depth,
    ).toBe(2);
  });

  it("sizes the target by every contributor of the history when nobody is active", () => {
    // 5 contributors: target 10; |4-10|=6, |9-10|=1, |30-10|=20
    expect(
      recommendDepth({
        levels: levelsOf(4, 9, 30),
        activeContributors: 0,
        historyContributors: 5,
      }),
    ).toStrictEqual({
      depth: 2,
      reason: "level 2: 9 areas for 5 contributors",
    });
  });

  it("picks the coarser level on a tie", () => {
    // 4 active contributors: target 8; |6-8|=2 and |10-8|=2
    expect(
      recommendDepth({
        levels: levelsOf(6, 10),
        activeContributors: 4,
        historyContributors: 4,
      }).depth,
    ).toBe(1);
  });

  it("picks the only level there is, in the singular", () => {
    expect(
      recommendDepth({
        levels: levelsOf(1),
        activeContributors: 1,
        historyContributors: 1,
      }),
    ).toStrictEqual({
      depth: 1,
      reason: "level 1: 1 area for 1 active contributor",
    });
  });
});

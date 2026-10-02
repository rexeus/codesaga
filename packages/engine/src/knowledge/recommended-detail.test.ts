import { describe, expect, it } from "vitest";

import { recommendDetail } from "./recommended-detail.js";

const detailsOf = (...viableTerritories: ReadonlyArray<number>) =>
  viableTerritories.map((count, index) => ({
    detail: index + 1,
    viableTerritories: count,
  }));

describe("recommendDetail", () => {
  it("aims at two territories per active contributor and states the choice", () => {
    // 6 active contributors: target 12; |4-12|=8, |11-12|=1, |20-12|=8
    expect(
      recommendDetail({
        details: detailsOf(4, 11, 20),
        activeContributors: 6,
        historyContributors: 30,
      }),
    ).toStrictEqual({
      detail: 2,
      reason:
        "detail 2: 11 territories with 3+ files for 6 active contributors",
    });
  });

  it("clamps the target to 4 territories for a single contributor", () => {
    // target 2 becomes 4; |3-4|=1, |6-4|=2
    expect(
      recommendDetail({
        details: detailsOf(3, 6),
        activeContributors: 1,
        historyContributors: 1,
      }).detail,
    ).toBe(1);
  });
});

describe("recommendDetail targets", () => {
  it("clamps the target to 25 territories for a large team", () => {
    // target 80 becomes 25; |10-25|=15, |24-25|=1, |60-25|=35
    expect(
      recommendDetail({
        details: detailsOf(10, 24, 60),
        activeContributors: 40,
        historyContributors: 90,
      }).detail,
    ).toBe(2);
  });

  it("sizes the target by every contributor of the history when nobody is active", () => {
    // 5 contributors: target 10; |4-10|=6, |9-10|=1, |30-10|=20
    expect(
      recommendDetail({
        details: detailsOf(4, 9, 30),
        activeContributors: 0,
        historyContributors: 5,
      }),
    ).toStrictEqual({
      detail: 2,
      reason: "detail 2: 9 territories with 3+ files for 5 contributors",
    });
  });

  it("picks the coarser detail on a tie", () => {
    // 4 active contributors: target 8; |6-8|=2 and |10-8|=2
    expect(
      recommendDetail({
        details: detailsOf(6, 10),
        activeContributors: 4,
        historyContributors: 4,
      }).detail,
    ).toBe(1);
  });

  it("picks the only detail there is, in the singular", () => {
    expect(
      recommendDetail({
        details: detailsOf(1),
        activeContributors: 1,
        historyContributors: 1,
      }),
    ).toStrictEqual({
      detail: 1,
      reason: "detail 1: 1 territory with 3+ files for 1 active contributor",
    });
  });
});

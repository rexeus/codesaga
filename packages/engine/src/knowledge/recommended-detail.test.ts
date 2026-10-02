import { describe, expect, it } from "vitest";

import { recommendDetail } from "./recommended-detail.js";

const detailsOf = (...viableTerritories: ReadonlyArray<number>) =>
  viableTerritories.map((count, index) => ({
    detail: index + 1,
    viableTerritories: count,
  }));

describe("recommendDetail", () => {
  it("goes as deep as the team allows, two territories per active contributor, and states the choice", () => {
    // 6 active contributors allow 12 territories; detail 3 has 20
    expect(
      recommendDetail({
        details: detailsOf(4, 11, 20),
        expertiseDetail: 3,
        activeContributors: 6,
        historyContributors: 30,
      }),
    ).toStrictEqual({
      detail: 2,
      reason:
        "detail 2: 11 territories with 3+ files for 6 active contributors",
    });
  });

  it("allows a detail with exactly as many territories as the team allows", () => {
    // 4 active contributors allow 8
    expect(
      recommendDetail({
        details: detailsOf(4, 8),
        expertiseDetail: 2,
        activeContributors: 4,
        historyContributors: 4,
      }).detail,
    ).toBe(2);
  });

  it("stops where further details no longer separate different experts", () => {
    // 6 active contributors allow 12, but detail 3 only splits by size
    expect(
      recommendDetail({
        details: detailsOf(4, 6, 8),
        expertiseDetail: 2,
        activeContributors: 6,
        historyContributors: 6,
      }).detail,
    ).toBe(2);
  });

  it("goes past the last expertise split while the territories are fewer than 4", () => {
    // 4 active contributors allow 8; no expertise gain, but 1, 2 and 3 territories say too little; detail 4 has 9
    expect(
      recommendDetail({
        details: detailsOf(1, 2, 3, 9),
        expertiseDetail: 1,
        activeContributors: 4,
        historyContributors: 4,
      }).detail,
    ).toBe(3);
  });

  it("stops past the last expertise split once there are 4 territories", () => {
    expect(
      recommendDetail({
        details: detailsOf(2, 4, 5),
        expertiseDetail: 1,
        activeContributors: 6,
        historyContributors: 6,
      }).detail,
    ).toBe(2);
  });
});

describe("recommendDetail allowance", () => {
  it("allows at least 4 territories for a single contributor", () => {
    // 2 territories per contributor would be 2; the minimum is 4, which detail 2 (6) exceeds
    expect(
      recommendDetail({
        details: detailsOf(3, 6),
        expertiseDetail: 2,
        activeContributors: 1,
        historyContributors: 1,
      }).detail,
    ).toBe(1);
  });

  it("allows at most 25 territories for a large team", () => {
    // 40 active contributors would allow 80; the maximum is 25, which detail 3 (60) exceeds
    expect(
      recommendDetail({
        details: detailsOf(10, 24, 60),
        expertiseDetail: 3,
        activeContributors: 40,
        historyContributors: 90,
      }).detail,
    ).toBe(2);
  });

  it("sizes the allowance by every contributor of the history when nobody is active", () => {
    // 5 contributors allow 10
    expect(
      recommendDetail({
        details: detailsOf(4, 9, 30),
        expertiseDetail: 3,
        activeContributors: 0,
        historyContributors: 5,
      }),
    ).toStrictEqual({
      detail: 2,
      reason: "detail 2: 9 territories with 3+ files for 5 contributors",
    });
  });
});

describe("recommendDetail fallbacks", () => {
  it("falls back to detail 1 however many territories it has", () => {
    expect(
      recommendDetail({
        details: detailsOf(39, 70),
        expertiseDetail: 2,
        activeContributors: 123,
        historyContributors: 378,
      }).detail,
    ).toBe(1);
  });

  it("picks the only detail there is, in the singular", () => {
    expect(
      recommendDetail({
        details: detailsOf(1),
        expertiseDetail: 1,
        activeContributors: 1,
        historyContributors: 1,
      }),
    ).toStrictEqual({
      detail: 1,
      reason: "detail 1: 1 territory with 3+ files for 1 active contributor",
    });
  });
});

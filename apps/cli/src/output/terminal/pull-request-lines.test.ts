import { describe, expect, it } from "vitest";

import { samplePullRequests } from "../../testing/sample-pull-requests.js";
import { pullRequestLines } from "./pull-request-lines.js";
import { makeStyle } from "./style.js";

const render = (overrides: Partial<ReturnType<typeof samplePullRequests>>) =>
  pullRequestLines({ ...samplePullRequests(), ...overrides }, makeStyle(false));

describe("pullRequestLines", () => {
  it("shows the counts, the median times and the three most active reviewers", () => {
    expect(render({})).toStrictEqual([
      "Pull requests              48 opened · 41 merged · 3 closed unmerged",
      "                           median 8.5 h to merge · 1.5 h to first review",
      "                           reviews by tomas 31 · maya 22 · priya 15",
    ]);
  });

  it.each([
    [0.5, "30 min"],
    [1, "1 h"],
    [47.96, "48 h"],
    [48, "2 days"],
    [80, "3.3 days"],
  ])("writes %s hours as %s", (hours, expected) => {
    const [, times] = render({ medianHoursToMerge: hours });

    expect(times).toContain(`median ${expected} to merge`);
  });

  it("leaves out the times and reviewers that do not exist", () => {
    expect(
      render({
        medianHoursToMerge: null,
        medianHoursToFirstReview: null,
        reviewers: [],
      }),
    ).toStrictEqual([
      "Pull requests              48 opened · 41 merged · 3 closed unmerged",
    ]);
  });

  it("says when the window had no pull requests", () => {
    expect(
      render({
        opened: 0,
        merged: 0,
        closedUnmerged: 0,
        medianHoursToMerge: null,
      }),
    ).toContain("Pull requests              none in the window");
  });

  it("warns that a truncated fetch undercounts", () => {
    expect(render({ truncated: true, fetched: 1000 }).at(-1)).toBe(
      "                           incomplete: only 1,000 pull requests fetched",
    );
  });

  it("escapes a login before printing it", () => {
    const [, , reviewers] = render({
      reviewers: [{ login: "x\u001B[31m", reviews: 1, approvals: 0 }],
    });

    expect(reviewers).toBe(
      "                           reviews by x\\u001b[31m 1",
    );
  });
});

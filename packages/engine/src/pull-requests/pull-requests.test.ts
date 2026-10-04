import { describe, expect, it } from "vitest";

import { pullRequestsSection } from "./pull-requests.js";
import type { PullRequestRecord } from "./pull-requests.js";

const window = {
  since: "2026-02-01T00:00:00.000Z",
  until: "2026-04-15T00:00:00.000Z",
};
const months = ["2026-02", "2026-03", "2026-04"];

const pull = (
  number: number,
  fields: Partial<PullRequestRecord>,
): PullRequestRecord => ({
  number,
  author: "ada",
  createdAt: "2026-02-10T00:00:00Z",
  mergedAt: null,
  closedAt: null,
  reviews: [],
  ...fields,
});

const review = (author: string, state: string, submittedAt: string) => ({
  author,
  state,
  submittedAt,
});

const sectionOf = (pulls: ReadonlyArray<PullRequestRecord>) =>
  pullRequestsSection({
    host: "github.com",
    repository: "acme/web",
    pulls,
    truncated: false,
    reviewsTruncated: false,
    window,
    months,
  });

const mergedAfter = (hours: number): Partial<PullRequestRecord> => ({
  createdAt: "2026-03-01T00:00:00Z",
  mergedAt: new Date(Date.UTC(2026, 2, 1) + hours * 3_600_000).toISOString(),
});

describe("pullRequestsSection counts", () => {
  it("counts opened, merged and closed-unmerged pull requests of the window", () => {
    const section = sectionOf([
      // opened and merged in the window
      pull(1, {
        mergedAt: "2026-02-11T00:00:00Z",
        closedAt: "2026-02-11T00:00:00Z",
      }),
      // opened before the window, merged in it: merged only
      pull(2, {
        createdAt: "2026-01-20T00:00:00Z",
        mergedAt: "2026-02-03T00:00:00Z",
      }),
      // opened in the window, closed without a merge
      pull(3, {
        createdAt: "2026-03-01T00:00:00Z",
        closedAt: "2026-03-02T00:00:00Z",
      }),
      // opened before the window, closed without a merge inside it: closed only
      pull(4, {
        createdAt: "2026-01-05T00:00:00Z",
        closedAt: "2026-02-20T00:00:00Z",
      }),
      // still open
      pull(5, { createdAt: "2026-04-01T00:00:00Z" }),
    ]);

    expect(section).toMatchObject({
      fetched: 5,
      opened: 3,
      merged: 2,
      closedUnmerged: 2,
      repository: "acme/web",
      host: "github.com",
      truncated: false,
      reviewsTruncated: false,
    });
  });

  it("buckets opened and merged pull requests by calendar month, zero where nothing happened", () => {
    const section = sectionOf([
      pull(1, {
        createdAt: "2026-02-28T23:00:00Z",
        mergedAt: "2026-03-01T01:00:00Z",
      }),
      pull(2, { createdAt: "2026-02-03T00:00:00Z" }),
      pull(3, {
        createdAt: "2026-04-02T00:00:00Z",
        mergedAt: "2026-04-03T00:00:00Z",
      }),
    ]);

    expect(section.months).toStrictEqual([
      { month: "2026-02", opened: 2, merged: 0 },
      { month: "2026-03", opened: 0, merged: 1 },
      { month: "2026-04", opened: 1, merged: 1 },
    ]);
  });
});

describe("pullRequestsSection medians", () => {
  it("takes the median hours to merge, the mean of the middle two for an even count", () => {
    // 2 h, 6 h, 24 h, 100 h
    const pulls = [2, 6, 24, 100].map((hours, index) =>
      pull(index + 1, mergedAfter(hours)),
    );

    expect(sectionOf(pulls).medianHoursToMerge).toBe(15);
    expect(sectionOf(pulls.slice(0, 3)).medianHoursToMerge).toBe(6);
    expect(sectionOf([]).medianHoursToMerge).toBeNull();
  });

  it("measures the first review from opening, skipping the author, bots and pull requests without one", () => {
    const section = sectionOf([
      pull(1, {
        createdAt: "2026-03-01T00:00:00Z",
        reviews: [
          review("ada", "COMMENTED", "2026-03-01T01:00:00Z"),
          review("codecov[bot]", "COMMENTED", "2026-03-01T02:00:00Z"),
          review("grace", "APPROVED", "2026-03-01T10:00:00Z"),
          review("linus", "COMMENTED", "2026-03-01T04:00:00Z"),
        ],
      }),
      pull(2, {
        createdAt: "2026-03-02T00:00:00Z",
        reviews: [review("grace", "APPROVED", "2026-03-02T08:00:00Z")],
      }),
      pull(3, { createdAt: "2026-03-03T00:00:00Z" }),
    ]);

    // pull request 1 waited 4 h, pull request 2 waited 8 h
    expect(section.medianHoursToFirstReview).toBe(6);
  });
});

describe("pullRequestsSection people", () => {
  it("lists authors by opened, then merged, then login, and leaves bots to the totals", () => {
    const merged = { mergedAt: "2026-02-12T00:00:00Z" };
    const section = sectionOf([
      pull(1, { author: "grace", ...merged }),
      pull(2, { author: "grace" }),
      pull(3, { author: "ada", ...merged }),
      pull(4, { author: "ada" }),
      pull(5, { author: "linus" }),
      pull(6, { author: "dependabot[bot]", ...merged }),
      pull(7, { author: "effect-bot", ...merged }),
      pull(8, { author: "Abbot" }),
    ]);

    expect(section.authors).toStrictEqual([
      { login: "ada", opened: 2, merged: 1 },
      { login: "grace", opened: 2, merged: 1 },
      { login: "Abbot", opened: 1, merged: 0 },
      { login: "linus", opened: 1, merged: 0 },
    ]);
    expect(section.totals.authors).toBe(4);
    expect(section.opened).toBe(8);
    expect(section.merged).toBe(4);
  });

  it("counts only reviews of others' pull requests submitted in the window, with approvals", () => {
    const section = sectionOf([
      pull(1, {
        author: "ada",
        reviews: [
          review("grace", "APPROVED", "2026-02-11T00:00:00Z"),
          review("grace", "COMMENTED", "2026-02-12T00:00:00Z"),
          // before the window
          review("grace", "APPROVED", "2026-01-30T00:00:00Z"),
          // on the author's own pull request
          review("ada", "COMMENTED", "2026-02-12T00:00:00Z"),
          review("ci-review[bot]", "APPROVED", "2026-02-12T00:00:00Z"),
        ],
      }),
      pull(2, {
        author: "grace",
        reviews: [review("linus", "APPROVED", "2026-03-01T00:00:00Z")],
      }),
    ]);

    expect(section.reviewers).toStrictEqual([
      { login: "grace", reviews: 2, approvals: 1 },
      { login: "linus", reviews: 1, approvals: 1 },
    ]);
    expect(section.totals.reviewers).toBe(2);
  });
});

describe("pullRequestsSection deleted accounts", () => {
  it("lists a deleted account like a bot, in no list but in the counts", () => {
    const section = sectionOf([
      pull(1, { author: "ghost", mergedAt: "2026-02-12T00:00:00Z" }),
      pull(2, {
        author: "ada",
        reviews: [
          review("ghost", "APPROVED", "2026-02-11T00:00:00Z"),
          review("grace", "COMMENTED", "2026-02-11T00:00:00Z"),
        ],
      }),
    ]);

    expect(section.authors).toStrictEqual([
      { login: "ada", opened: 1, merged: 0 },
    ]);
    expect(section.reviewers).toStrictEqual([
      { login: "grace", reviews: 1, approvals: 0 },
    ]);
    expect([section.opened, section.merged]).toStrictEqual([2, 1]);
  });

  it("does not take a deleted reviewer for the deleted author reviewing their own pull request", () => {
    const section = sectionOf([
      pull(1, {
        author: "ghost",
        createdAt: "2026-03-01T00:00:00Z",
        reviews: [review("ghost", "APPROVED", "2026-03-01T05:00:00Z")],
      }),
      // a named author's own review is still no review
      pull(2, {
        author: "ada",
        createdAt: "2026-03-01T00:00:00Z",
        reviews: [review("ada", "COMMENTED", "2026-03-01T01:00:00Z")],
      }),
    ]);

    // pull request 1 waited 5 h for a review by someone; pull request 2 got none
    expect(section.medianHoursToFirstReview).toBe(5);
  });
});

describe("pullRequestsSection reviewsTruncated", () => {
  it("passes on that some pull requests have more reviews than were fetched", () => {
    const section = pullRequestsSection({
      host: "github.com",
      repository: "acme/web",
      pulls: [],
      truncated: false,
      reviewsTruncated: true,
      window,
      months,
    });

    expect(section.reviewsTruncated).toBe(true);
  });
});

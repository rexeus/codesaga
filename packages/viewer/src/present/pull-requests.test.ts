import { describe, expect, it } from "vitest";

import {
  listLimitNotes,
  pullRequestFigures,
  pullRequestNotes,
} from "./pull-requests.js";

const section = {
  host: "github.com",
  repository: "acme/web",
  fetched: 212,
  truncated: false,
  reviewsTruncated: false,
  opened: 48,
  merged: 41,
  closedUnmerged: 3,
  medianHoursToMerge: 8.5,
  medianHoursToFirstReview: null,
  months: [],
  authors: [],
  reviewers: [],
  totals: { authors: 0, reviewers: 0 },
};

describe("pullRequestFigures durations", () => {
  it.each([
    [null, "–"],
    [0.5, "30 min"],
    [1, "1 h"],
    [8.54, "8.5 h"],
    [48, "2 days"],
    [80, "3.3 days"],
  ])("writes %s hours as %s", (hours, expected) => {
    const [, merge] = pullRequestFigures({
      ...section,
      medianHoursToMerge: hours,
    });

    expect(merge?.value).toBe(expected);
  });
});

describe("pullRequestFigures", () => {
  it("reads the counts and both median times, with a dash for a missing one", () => {
    expect(pullRequestFigures(section)).toStrictEqual([
      { label: "Opened", value: "48", detail: "41 merged, 3 closed unmerged" },
      {
        label: "Median time to merge",
        value: "8.5 h",
        detail: "from opening to the merge",
      },
      {
        label: "Median time to first review",
        value: "–",
        detail: "until someone else reviewed",
      },
    ]);
  });
});

describe("pullRequestNotes", () => {
  it("names the source and the missing identity mapping, and warns about a truncated fetch", () => {
    expect(pullRequestNotes(section)).toHaveLength(1);
    expect(pullRequestNotes(section)[0]).toContain("github.com/acme/web");
    expect(
      pullRequestNotes({ ...section, truncated: true, fetched: 1000 }),
    ).toContain(
      "Only 1,000 pull requests were fetched, so every figure here undercounts.",
    );
  });

  it("warns that review figures undercount when some pull request has more reviews than were fetched", () => {
    expect(pullRequestNotes({ ...section, reviewsTruncated: true })).toContain(
      "Some pull requests have more reviews than were fetched, so the review figures undercount.",
    );
  });
});

describe("listLimitNotes", () => {
  const person = { login: "ada", opened: 1, merged: 1 };

  it("says which of the lists the report cut short, with the full sizes", () => {
    const limited = {
      ...section,
      authors: [person],
      reviewers: [],
      totals: { authors: 1200, reviewers: 0 },
    };

    expect(listLimitNotes(limited)).toStrictEqual([
      "Showing 1 of 1,200 authors: the report was limited.",
    ]);
    expect(
      listLimitNotes({ ...limited, totals: { authors: 3, reviewers: 5 } }),
    ).toStrictEqual([
      "Showing 1 of 3 authors: the report was limited.",
      "Showing 0 of 5 reviewers: the report was limited.",
    ]);
  });

  it("is silent when every author and reviewer is listed", () => {
    expect(
      listLimitNotes({
        ...section,
        authors: [person],
        totals: { authors: 1, reviewers: 0 },
      }),
    ).toStrictEqual([]);
  });
});

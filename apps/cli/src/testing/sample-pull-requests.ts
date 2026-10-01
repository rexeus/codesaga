// Pull requests for renderer tests: a section that a report from `--github` would carry.
import type { Report } from "@codesaga/engine";

/** 48 opened, 41 merged, 6 authors and 6 reviewers, in the order the engine lists them. */
export const samplePullRequests = (): NonNullable<Report["pullRequests"]> => ({
  host: "github.com",
  repository: "aurora/aurora-web",
  fetched: 212,
  truncated: false,
  opened: 48,
  merged: 41,
  closedUnmerged: 3,
  medianHoursToMerge: 8.5,
  medianHoursToFirstReview: 1.5,
  months: [
    { month: "2026-01", opened: 14, merged: 12 },
    { month: "2026-02", opened: 19, merged: 17 },
    { month: "2026-03", opened: 15, merged: 12 },
  ],
  authors: [
    { login: "maya", opened: 17, merged: 15 },
    { login: "tomas", opened: 12, merged: 10 },
    { login: "priya", opened: 9, merged: 8 },
    { login: "jonas", opened: 6, merged: 5 },
    { login: "aiko", opened: 3, merged: 3 },
    { login: "lena", opened: 1, merged: 0 },
  ],
  reviewers: [
    { login: "tomas", reviews: 31, approvals: 20 },
    { login: "maya", reviews: 22, approvals: 14 },
    { login: "priya", reviews: 15, approvals: 9 },
    { login: "jonas", reviews: 9, approvals: 6 },
    { login: "aiko", reviews: 4, approvals: 3 },
    { login: "lena", reviews: 1, approvals: 1 },
  ],
  totals: { authors: 6, reviewers: 6 },
});

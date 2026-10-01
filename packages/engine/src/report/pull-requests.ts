// Owns the shape of the `pullRequests` section of the report: pull requests and reviews read from GitHub.
import { Schema } from "effect";

const Count = Schema.Natural;
/** Hours, rounded to 4 decimals; null when no pull request qualifies. */
const Hours = Schema.NullOr(
  Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
);

/**
 * Pull requests and reviews of the window, present only with `--github`. The
 * repository's pull requests are not narrowed to the path scope. GitHub logins
 * are not mapped to git identities, so a person can appear here and in
 * `contributors` under different names. Counts give context, not a ranking.
 *
 * Bot logins (ending in `[bot]`) and deleted accounts (`ghost`) count in the
 * totals but are not listed in `authors` or `reviewers`, and a reviewer's
 * reviews on their own pull requests do not count. Each list is possibly truncated (see `totals`).
 */
export const PullRequests = Schema.Struct({
  /** The GitHub host the pull requests came from, such as `github.com`. */
  host: Schema.String,
  /** `owner/name` of the repository, from the `origin` remote. */
  repository: Schema.String,
  /** Pull requests fetched: those opened or closed since the window started, at most 1,000. */
  fetched: Count,
  /** More pull requests matched than were fetched, so every figure below undercounts. */
  truncated: Schema.Boolean,
  /** Some pull request has more than 100 reviews, of which only the first 100 were fetched, so review figures undercount. */
  reviewsTruncated: Schema.Boolean,
  /** Pull requests opened in the window. */
  opened: Count,
  /** Pull requests merged in the window, whenever they were opened. */
  merged: Count,
  /** Pull requests closed without a merge in the window. */
  closedUnmerged: Count,
  /** Median hours from opening to merge, over the merged ones. */
  medianHoursToMerge: Hours,
  /** Median hours from opening to the first review by someone else, over pull requests opened in the window that got one. */
  medianHoursToFirstReview: Hours,
  /** Consecutive calendar months of the window, oldest first, matching `activity.months`. */
  months: Schema.Array(
    Schema.Struct({ month: Schema.String, opened: Count, merged: Count }),
  ),
  /** People who opened or merged a pull request, most opened first, then most merged, then login. */
  authors: Schema.Array(
    Schema.Struct({ login: Schema.String, opened: Count, merged: Count }),
  ),
  /** People who reviewed others' pull requests in the window, most reviews first, then most approvals, then login. */
  reviewers: Schema.Array(
    Schema.Struct({ login: Schema.String, reviews: Count, approvals: Count }),
  ),
  /** Sizes before any output limit. */
  totals: Schema.Struct({ authors: Count, reviewers: Count }),
});
export type PullRequests = typeof PullRequests.Type;

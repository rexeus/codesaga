import type { Report } from "@codesaga/engine";

import { formatCount } from "./format.js";

type PullRequests = NonNullable<Report["pullRequests"]>;

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const MAX_HOURS_SHOWN = 48;
const NOT_AVAILABLE = "–";

/** A time in hours in the unit that reads best: `45 min`, `8.5 h`, `3.2 days`; a dash without a value. */
const formatDuration = (hours: number | null): string => {
  if (hours === null) {
    return NOT_AVAILABLE;
  }
  if (hours < 1) {
    return `${Math.round(hours * MINUTES_PER_HOUR)} min`;
  }
  return hours < MAX_HOURS_SHOWN
    ? `${Number(hours.toFixed(1))} h`
    : `${Number((hours / HOURS_PER_DAY).toFixed(1))} days`;
};

/** One headline figure of the pull request section. */
export type PullRequestFigure = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
};

/** The section's tiles: how many were opened, and the two median times. */
export const pullRequestFigures = ({
  opened,
  merged,
  closedUnmerged,
  medianHoursToMerge,
  medianHoursToFirstReview,
}: PullRequests): PullRequestFigure[] => [
  {
    label: "Opened",
    value: formatCount(opened),
    detail: `${formatCount(merged)} merged, ${formatCount(closedUnmerged)} closed unmerged`,
  },
  {
    label: "Median time to merge",
    value: formatDuration(medianHoursToMerge),
    detail: "from opening to the merge",
  },
  {
    label: "Median time to first review",
    value: formatDuration(medianHoursToFirstReview),
    detail: "until someone else reviewed",
  },
];

/** A sentence for each of the authors and reviewers lists the report cut short with `--limit`. */
export const listLimitNotes = ({
  authors,
  reviewers,
  totals,
}: PullRequests): string[] =>
  [
    { noun: "authors", shown: authors.length, all: totals.authors },
    { noun: "reviewers", shown: reviewers.length, all: totals.reviewers },
  ]
    .filter(({ shown, all }) => all > shown)
    .map(
      ({ noun, shown, all }) =>
        `Showing ${formatCount(shown)} of ${formatCount(all)} ${noun}: the report was limited.`,
    );

/** The caveats of the section's numbers, each a sentence. */
export const pullRequestNotes = ({
  host,
  repository,
  fetched,
  truncated,
}: PullRequests): string[] => [
  `Read from ${host}/${repository}. GitHub logins are not matched to git identities, so a person can appear here and under Contributors with different names.`,
  ...(truncated
    ? [
        `Only ${formatCount(fetched)} pull requests were fetched, so every figure here undercounts.`,
      ]
    : []),
];

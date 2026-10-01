// Owns the pull request block of the `analyze` view: what was opened and merged, how long it took, who reviewed.
// Every login that came from GitHub passes through terminal-safe escaping.
import type { Report } from "@codesaga/engine";

import { count, duration, plural } from "./format.js";
import { fitEscaped, MAX_NAME_WIDTH, section } from "./layout.js";
import type { Style } from "./style.js";

const TOP_REVIEWERS = 3;
const SEPARATOR = " · ";

type PullRequests = NonNullable<Report["pullRequests"]>;

const countsLine = ({
  opened,
  merged,
  closedUnmerged,
}: PullRequests): string =>
  opened + merged + closedUnmerged === 0
    ? "none in the window"
    : [
        `${count(opened)} opened`,
        `${count(merged)} merged`,
        `${count(closedUnmerged)} closed unmerged`,
      ].join(SEPARATOR);

const timesLine = ({
  medianHoursToMerge,
  medianHoursToFirstReview,
}: PullRequests): ReadonlyArray<string> => {
  const parts = [
    ...(medianHoursToMerge === null
      ? []
      : [`median ${duration(medianHoursToMerge)} to merge`]),
    ...(medianHoursToFirstReview === null
      ? []
      : [`${duration(medianHoursToFirstReview)} to first review`]),
  ];
  return parts.length === 0 ? [] : [parts.join(SEPARATOR)];
};

const reviewersLine = ({ reviewers }: PullRequests): ReadonlyArray<string> =>
  reviewers.length === 0
    ? []
    : [
        `reviews by ${reviewers
          .slice(0, TOP_REVIEWERS)
          .map(
            ({ login, reviews }) =>
              `${fitEscaped(login, MAX_NAME_WIDTH)} ${count(reviews)}`,
          )
          .join(SEPARATOR)}`,
      ];

/** The "Pull requests" section of a report that has one: counts, median times and the most active reviewers. */
export const pullRequestLines = (
  pullRequests: PullRequests,
  style: Style,
): ReadonlyArray<string> =>
  section(
    "Pull requests",
    [
      countsLine(pullRequests),
      ...timesLine(pullRequests),
      ...reviewersLine(pullRequests),
      ...(pullRequests.truncated
        ? [
            `incomplete: only ${plural(pullRequests.fetched, "pull request")} fetched`,
          ]
        : []),
    ],
    style,
  );

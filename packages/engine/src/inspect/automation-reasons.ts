// Owns the plain-language notes about agent involvement in the commits of an inspected path set.
// Bots are left out: the question is how much of the work people did with agents.

import type { ClassifiedCommit } from "../automation/classify.js";
import { groupBy } from "../collections/group-by.js";

const MAX_TOOLS = 3;

const percent = (part: number, whole: number): string => {
  const value = (part / whole) * 100;
  return value < 0.5 ? "<1%" : `${Math.round(value)}%`;
};

/** The tools of `commits`, most commits first, then by name. */
const toolsOf = (commits: ReadonlyArray<ClassifiedCommit>): string =>
  [...groupBy(commits, ({ tool }) => tool ?? "an AI agent")]
    .toSorted(
      ([a, own], [b, other]) => other.length - own.length || a.localeCompare(b),
    )
    .slice(0, MAX_TOOLS)
    .map(([tool]) => tool)
    .join(", ");

const reasonFor = (
  commits: ReadonlyArray<ClassifiedCommit>,
  total: number,
  verb: string,
): ReadonlyArray<string> =>
  commits.length === 0
    ? []
    : [
        `${percent(commits.length, total)} of ${total} commits in the window were ${verb} ${toolsOf(commits)}`,
      ];

/** One note for the commits co-authored with an agent and one for those an agent authored, when there are any. */
export const automationReasons = (
  commits: ReadonlyArray<ClassifiedCommit>,
): ReadonlyArray<string> => [
  ...reasonFor(
    commits.filter(
      ({ class: commitClass }) => commitClass === "agent-assisted",
    ),
    commits.length,
    "co-authored by",
  ),
  ...reasonFor(
    commits.filter(({ class: commitClass }) => commitClass === "agent"),
    commits.length,
    "authored by",
  ),
];

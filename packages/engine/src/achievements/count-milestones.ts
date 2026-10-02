// Owns the milestones that count the history: the commits, the days it spans and the people behind it.
// The first and the third are tiered. A tier's day is the day its Nth commit or contributor first appeared.

import type { Achievement } from "../report/achievements.js";
import { countOf, nounOf } from "../report/sentences.js";
import type { HistoryFacts } from "./history-facts.js";
import { detailOf, reachedOn, utcDayOf } from "./reached-on.js";
import { ACHIEVEMENT_THRESHOLDS } from "./thresholds.js";

const { firstCommitsTiers, marathonDays, communityTiers } =
  ACHIEVEMENT_THRESHOLDS;

const SECONDS_PER_DAY = 86_400;

type Counted = Pick<HistoryFacts, "commitTimes" | "contributorStarts">;

/** The tier fields of a count that passes `tiers`, and the threshold of the highest tier it reached. */
const tiering = (tiers: ReadonlyArray<number>, value: number, unit: string) => {
  const tier = tiers.filter((threshold) => value >= threshold).length;
  const next = tiers[tier];
  const fields = {
    ...(tier === 0 ? {} : { tier }),
    tiers,
    reached: tier > 0,
    progress: next === undefined ? null : { value, target: next, unit },
  } satisfies Pick<Achievement, "tier" | "tiers" | "reached" | "progress">;
  return { fields, threshold: tiers[tier - 1] };
};

/** The time at which the `threshold`th entry of a sorted list of times appeared. */
const timeOfNth = (
  times: ReadonlyArray<number>,
  threshold: number | undefined,
): number | undefined =>
  threshold === undefined ? undefined : times[threshold - 1];

/** `first-commits`: the commit count, in tiers; its title names the highest tier reached, or the first. */
export const firstCommits = (
  { commitTimes }: Counted,
  shallow: boolean,
): Achievement => {
  const { fields, threshold } = tiering(
    firstCommitsTiers,
    commitTimes.length,
    "commits",
  );
  const reachedAt = reachedOn(shallow, timeOfNth(commitTimes, threshold));
  return {
    kind: "first-commits",
    title: `First ${countOf(threshold ?? firstCommitsTiers[0] ?? 0)} commits`,
    ...fields,
    reachedAt,
    holds: "milestone",
    detail: detailOf(
      shallow,
      reachedAt === null
        ? `${nounOf(commitTimes.length, "commit")} so far.`
        : `The ${countOf(threshold ?? 0)}th commit landed on ${reachedAt}.`,
    ),
  };
};

/** `marathon`: the days between the first and the last commit. */
export const marathon = (
  { commitTimes }: Counted,
  shallow: boolean,
): Achievement => {
  const first = commitTimes[0];
  const last = commitTimes.at(-1);
  const days =
    first === undefined || last === undefined
      ? 0
      : Math.floor((last - first) / SECONDS_PER_DAY);
  const reached = days >= marathonDays;
  return {
    kind: "marathon",
    title: "Marathon",
    reached,
    reachedAt: reachedOn(
      shallow,
      reached && first !== undefined
        ? first + marathonDays * SECONDS_PER_DAY
        : undefined,
    ),
    holds: "milestone",
    detail: detailOf(
      shallow,
      first === undefined
        ? "No history yet."
        : `${nounOf(days, "day")} of history since ${utcDayOf(first)}.`,
    ),
    progress: reached
      ? null
      : { value: days, target: marathonDays, unit: "days" },
  };
};

/** `community`: the people with a commit over the full history, in tiers; no one is named. */
export const community = (
  { contributorStarts }: Counted,
  shallow: boolean,
): Achievement => {
  const people = contributorStarts.length;
  const { fields, threshold } = tiering(communityTiers, people, "contributors");
  const reachedAt = reachedOn(shallow, timeOfNth(contributorStarts, threshold));
  const joined =
    reachedAt === null
      ? ""
      : `; the ${countOf(threshold ?? 0)}th joined ${reachedAt}`;
  return {
    kind: "community",
    title: "Community",
    ...fields,
    reachedAt,
    holds: "milestone",
    detail: detailOf(
      shallow,
      fields.reached
        ? `${nounOf(people, "person", "people")} have committed${joined}.`
        : `${nounOf(people, "contributor")} so far.`,
    ),
  };
};

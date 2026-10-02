// Owns the stories read off the clock: longest streak, busiest day, night owls and weekend share.
// Separate from `history-events.ts` because these four only need commit times and the author's local time.
// Cost: one pass over the commits.

import {
  isoDateOfDay,
  localDayOf,
  localHourOf,
  weekdayOfDay,
} from "../activity/buckets.js";
import { isContributorCommit } from "../automation/classify.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { roundReported } from "../report/precision.js";
import { countOf, percentOf } from "../report/sentences.js";
import type { Story } from "../report/stories.js";
import type { StoryFacts } from "./stories.js";
import { STORY_THRESHOLDS } from "./thresholds.js";

const {
  streakMinDays,
  busiestDayMinCommits,
  rhythmMinCommits,
  nightOwlShare,
  nightFromHour,
  nightToHour,
  weekendShare,
} = STORY_THRESHOLDS;

const SATURDAY = 5;

const commitsPerDay = (
  commits: ReadonlyArray<ClassifiedCommit>,
): ReadonlyMap<number, number> => {
  const days = new Map<number, number>();
  for (const { time, offsetMinutes } of commits) {
    const day = localDayOf(time, offsetMinutes);
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  return days;
};

/** The first day and length of the longest run of consecutive days; the earliest wins a tie. */
const longestRun = (
  days: ReadonlyArray<number>,
): { readonly start: number; readonly length: number } => {
  let best = { start: 0, length: 0 };
  let run = { start: 0, length: 0 };
  for (const day of days.toSorted((a, b) => a - b)) {
    run =
      run.length > 0 && day === run.start + run.length
        ? { start: run.start, length: run.length + 1 }
        : { start: day, length: 1 };
    best = run.length > best.length ? run : best;
  }
  return best;
};

const streakStory = (
  days: ReadonlyMap<number, number>,
): ReadonlyArray<Story> => {
  const { start, length } = longestRun([...days.keys()]);
  return length < streakMinDays
    ? []
    : [
        {
          kind: "streak",
          title: "Longest streak",
          detail: `A commit landed every day from ${isoDateOfDay(start)} to ${isoDateOfDay(start + length - 1)}.`,
          value: length,
          date: isoDateOfDay(start),
        },
      ];
};

const busiestDayStory = (
  days: ReadonlyMap<number, number>,
): ReadonlyArray<Story> => {
  const [day, commits] = [...days].reduce<readonly [number, number]>(
    (best, entry) =>
      entry[1] > best[1] || (entry[1] === best[1] && entry[0] < best[0])
        ? entry
        : best,
    [0, 0],
  );
  return commits < busiestDayMinCommits
    ? []
    : [
        {
          kind: "busiest-day",
          title: "Busiest day",
          detail: `${countOf(commits)} commits landed on ${isoDateOfDay(day)}, the most on a single day.`,
          value: commits,
          date: isoDateOfDay(day),
        },
      ];
};

const isNight = (hour: number): boolean =>
  hour >= nightFromHour || hour < nightToHour;

const isWeekend = (day: number): boolean => weekdayOfDay(day) >= SATURDAY;

const hourLabel = (hour: number): string =>
  `${String(hour).padStart(2, "0")}:00`;

/** The night owls and the weekend share over the human commits; bots and agents work around the clock. */
const habitStories = (
  commits: ReadonlyArray<ClassifiedCommit>,
): ReadonlyArray<Story> => {
  const human = commits.filter((commit) => isContributorCommit(commit));
  if (human.length < rhythmMinCommits) {
    return [];
  }
  const night = human.filter(({ time, offsetMinutes }) =>
    isNight(localHourOf(time, offsetMinutes)),
  ).length;
  const weekend = human.filter(({ time, offsetMinutes }) =>
    isWeekend(localDayOf(time, offsetMinutes)),
  ).length;
  return [
    ...(night / human.length < nightOwlShare
      ? []
      : [
          {
            kind: "night-owls" as const,
            title: "Night owls",
            detail: `${percentOf(night / human.length)} of the human commits land between ${hourLabel(nightFromHour)} and ${hourLabel(nightToHour)} local time (${countOf(night)} of ${countOf(human.length)}).`,
            value: roundReported(night / human.length),
          },
        ]),
    ...(weekend / human.length < weekendShare
      ? []
      : [
          {
            kind: "weekend" as const,
            title: "Weekends",
            detail: `${percentOf(weekend / human.length)} of the human commits land on a Saturday or Sunday (${countOf(weekend)} of ${countOf(human.length)}).`,
            value: roundReported(weekend / human.length),
          },
        ]),
  ];
};

/**
 * The `streak`, `busiest-day`, `night-owls` and `weekend` findings that pass
 * their thresholds. Days are the author's local days. The streak and the
 * busiest day count commits of every class; night owls (22:00 to 05:00 local
 * time) and the weekend share count human and agent-assisted commits only and
 * need at least `rhythmMinCommits` of them.
 */
export const rhythmStories = ({
  commits,
}: StoryFacts): ReadonlyArray<Story> => {
  const days = commitsPerDay(commits);
  return [
    ...streakStory(days),
    ...busiestDayStory(days),
    ...habitStories(commits),
  ];
};

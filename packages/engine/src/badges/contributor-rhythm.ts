// Owns the rhythm badges: night owl, early bird and weekend regular, read off the author's local clock.
// Apart from `contributor-badges.ts` because they need only commit times and offsets, and need a guard for clocks they cannot trust.
// Cost: one pass over the contributor's commits per rule.

import type { DateTime } from "effect";

import {
  isoDateOfDay,
  localDayOf,
  localHourOf,
  weekdayOfDay,
} from "../activity/buckets.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { isActiveWithin } from "../contributors/activeness.js";
import { countOf, hourLabelOf, percentOf } from "../report/sentences.js";
import { STORY_THRESHOLDS } from "../stories/thresholds.js";
import type { EarnedContributorBadge } from "./contributor-badge-category.js";

/** The rules behind night owl, early bird and weekend regular, for the report's `thresholds.badges`. */
export const RHYTHM_BADGE_THRESHOLDS = {
  rhythmWindowDays: 365,
  rhythmMinCommits: 40,
  rhythmMinMonths: 3,
  rhythmShare: 0.25,
  rhythmNightFromHour: STORY_THRESHOLDS.nightFromHour,
  rhythmNightToHour: STORY_THRESHOLDS.nightToHour,
  rhythmEarlyToHour: 8,
  rhythmUtcShare: 0.9,
};

const {
  rhythmWindowDays,
  rhythmMinCommits,
  rhythmMinMonths,
  rhythmShare,
  rhythmNightFromHour,
  rhythmNightToHour,
  rhythmEarlyToHour,
  rhythmUtcShare,
} = RHYTHM_BADGE_THRESHOLDS;

const SATURDAY = 5;

type Habit = {
  readonly kind: EarnedContributorBadge["kind"];
  readonly label: string;
  /** The start of the evidence sentence, before the numbers. */
  readonly lead: string;
  /** The phrase after the share that says when the commits fall. */
  readonly when: string;
  readonly holds: (commit: ClassifiedCommit) => boolean;
};

const localHour = ({ time, offsetMinutes }: ClassifiedCommit): number =>
  localHourOf(time, offsetMinutes);

const HABITS: ReadonlyArray<Habit> = [
  {
    kind: "night-owl",
    label: "Night owl",
    lead: "Often commits late",
    when: `between ${hourLabelOf(rhythmNightFromHour)} and ${hourLabelOf(rhythmNightToHour)}`,
    holds: (commit) =>
      localHour(commit) >= rhythmNightFromHour ||
      localHour(commit) < rhythmNightToHour,
  },
  {
    kind: "early-bird",
    label: "Early bird",
    lead: "Often commits early",
    when: `between ${hourLabelOf(rhythmNightToHour)} and ${hourLabelOf(rhythmEarlyToHour)}`,
    holds: (commit) =>
      localHour(commit) >= rhythmNightToHour &&
      localHour(commit) < rhythmEarlyToHour,
  },
  {
    kind: "weekend-regular",
    label: "Weekend regular",
    lead: "Often commits at the weekend",
    when: "on a Saturday or Sunday",
    holds: ({ time, offsetMinutes }) =>
      weekdayOfDay(localDayOf(time, offsetMinutes)) >= SATURDAY,
  },
];

const localMonthOf = ({ time, offsetMinutes }: ClassifiedCommit): string =>
  isoDateOfDay(localDayOf(time, offsetMinutes)).slice(0, 7);

/**
 * Whether the commits look stamped by machines set to UTC: nearly all carry
 * +00:00 although others in the history do not. Then the clock says nothing
 * about the person's day.
 */
const isUntrustedClock = (
  commits: ReadonlyArray<ClassifiedCommit>,
  historyHasOtherOffsets: boolean,
): boolean =>
  historyHasOtherOffsets &&
  commits.filter(({ offsetMinutes }) => offsetMinutes === 0).length /
    commits.length >=
    rhythmUtcShare;

/**
 * Night owl (22:00 to 05:00), early bird (05:00 to 08:00) and weekend regular
 * (Saturday or Sunday), in the author's local time, each earned with at least
 * `rhythmShare` of the person's human commits of the last `rhythmWindowDays`
 * days. Needs at least `rhythmMinCommits` of them in `rhythmMinMonths` calendar
 * months, and is withheld when the clock is untrustworthy: at least
 * `rhythmUtcShare` of them carry +00:00 while `historyHasOtherOffsets`.
 * Agent-assisted commits are stamped by the agent's clock and do not count.
 * The evidence gives the share and the counts and compares with nobody.
 */
export const rhythmBadges = (
  commits: ReadonlyArray<ClassifiedCommit>,
  now: DateTime.Utc,
  historyHasOtherOffsets: boolean,
): ReadonlyArray<EarnedContributorBadge> => {
  const own = commits.filter(
    ({ class: commitClass, time }) =>
      commitClass === "human" && isActiveWithin(time, now, rhythmWindowDays),
  );
  if (
    own.length < rhythmMinCommits ||
    new Set(own.map((commit) => localMonthOf(commit))).size < rhythmMinMonths ||
    isUntrustedClock(own, historyHasOtherOffsets)
  ) {
    return [];
  }
  return HABITS.flatMap(({ kind, label, lead, when, holds }) => {
    const matching = own.filter((commit) => holds(commit)).length;
    return matching / own.length < rhythmShare
      ? []
      : [
          {
            kind,
            label,
            evidence: `${lead}: ${percentOf(matching / own.length)} of their commits in the last year ${when} (${countOf(matching)} of ${countOf(own.length)}).`,
          },
        ];
  });
};

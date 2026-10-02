// Owns the journey badges that read a person's whole history: founder, long-hauler and explorer.
// Apart from `contributor-tenure.ts`, which owns steady, new here and back again, because these need the files founded or the territories.
// Cost: one pass over the contributor's commits, and one lookup per changed path for the explorer.
import { DateTime } from "effect";

import { isoDateOfDay, localDayOf } from "../activity/buckets.js";
import { addMonths, monthsBetween } from "../activity/calendar.js";
import { isActiveWithin } from "../contributors/activeness.js";
import { isNewContributor } from "../contributors/status.js";
import { nounOf, percentOf } from "../report/sentences.js";
import type { BadgeContext } from "./contributor-badge-facts.js";
import { CONTRIBUTOR_BADGE_THRESHOLDS } from "./contributor-badge-thresholds.js";
import { territoryActivity } from "./contributor-territories.js";

const {
  founderShare,
  longHaulerYears,
  longHaulerQuarters,
  explorerDays,
  explorerMinTerritories,
} = CONTRIBUTOR_BADGE_THRESHOLDS;

const MONTHS_PER_YEAR = 12;
const MONTHS_PER_QUARTER = 3;

export const founder = ({ founded }: BadgeContext) =>
  founded.ofFiles > 0 && founded.files / founded.ofFiles >= founderShare
    ? {
        kind: "founder" as const,
        label: "Founder",
        evidence: `First author of ${percentOf(founded.files / founded.ofFiles)} of today's files.`,
      }
    : undefined;

const firstTimeOf = (times: ReadonlyArray<number>): number =>
  times.reduce((earliest, time) => Math.min(earliest, time));

/**
 * A first commit at least `longHaulerYears` years ago and a commit in each of
 * the last `longHaulerQuarters` quarters, counted back from now in blocks of
 * three calendar months. Withheld without `repositoryStart`: in a shallow
 * clone the first visible commit is not the first.
 */
export const longHauler = ({ commits, now, repositoryStart }: BadgeContext) => {
  const nowSeconds = DateTime.toEpochMillis(now) / 1000;
  const times = commits.map(({ time }) => time);
  const first = firstTimeOf(times);
  const years = Math.floor(monthsBetween(first, nowSeconds) / MONTHS_PER_YEAR);
  const everyQuarter = Array.from(
    { length: longHaulerQuarters },
    (_, index) => ({
      from: addMonths(nowSeconds, -MONTHS_PER_QUARTER * (index + 1)),
      to: addMonths(nowSeconds, -MONTHS_PER_QUARTER * index),
    }),
  ).every(({ from, to }) => times.some((time) => time > from && time <= to));
  return repositoryStart !== undefined &&
    years >= longHaulerYears &&
    everyQuarter
    ? {
        kind: "long-hauler" as const,
        label: "Long-hauler",
        evidence: `First commit on ${isoDateOfDay(localDayOf(first, 0))}, ${nounOf(years, "year")} ago, and a commit in each of the last ${longHaulerQuarters} quarters.`,
      }
    : undefined;
};

/**
 * First commits in at least `explorerMinTerritories` territories of the
 * recommended detail within the last `explorerDays` days, for someone who is
 * not new here, since that badge says it already. Leftover territories do not
 * count, and a shallow clone withholds it: a first commit seen there may not
 * be the first.
 */
export const explorer = ({
  commits,
  now,
  repositoryStart,
  territories = [],
}: BadgeContext) => {
  const first = firstTimeOf(commits.map(({ time }) => time));
  const entered = [
    ...territoryActivity(commits, territories).firstTouch.values(),
  ].filter((time) => isActiveWithin(time, now, explorerDays)).length;
  return repositoryStart !== undefined &&
    !isNewContributor(first, repositoryStart, now) &&
    entered >= explorerMinTerritories
    ? {
        kind: "explorer" as const,
        label: "Explorer",
        evidence: `First commits in ${nounOf(entered, "territory", "territories")} in the last ${explorerDays} days.`,
      }
    : undefined;
};

import type { Report } from "@codesaga/engine";

import { formatDateLong, formatMonth } from "../present/format.js";

type Activity = Report["activity"];

/** Whether each bar stands for a week or for a calendar month. */
export type Resolution = "weeks" | "months";

/** A span of time with its counts; `start` and `end` are UTC milliseconds. */
export type Bucket = {
  readonly label: string;
  readonly start: number;
  readonly end: number;
  readonly commits: number;
  readonly added: number;
  readonly deleted: number;
};

/** Bars narrower than this many pixels are unreadable, so months replace weeks. */
const MIN_BAR_STEP = 2;
const MS_PER_DAY = 86_400_000;

const weekStart = (week: string): number => Date.parse(`${week}T00:00:00Z`);

/** The start of `YYYY-MM` and of the month after it, in UTC milliseconds. */
export const monthSpan = (month: string): readonly [number, number] => {
  const [year = 0, number = 1] = month.split("-").map(Number);
  return [Date.UTC(year, number - 1), Date.UTC(year, number)];
};

const weekBuckets = ({ weeks }: Activity): Bucket[] =>
  weeks.map((week) => ({
    label: `Week of ${formatDateLong(week.start)}`,
    start: weekStart(week.start),
    end: weekStart(week.start) + 7 * MS_PER_DAY,
    commits: week.commits,
    added: week.added,
    deleted: week.deleted,
  }));

/**
 * Commits come from `months`, which the engine counts exactly. The report has
 * no monthly churn, so a week's lines count for the month of its Monday.
 */
const monthBuckets = ({ weeks, months }: Activity): Bucket[] => {
  const churn = new Map<string, { added: number; deleted: number }>();
  for (const week of weeks) {
    const month = week.start.slice(0, 7);
    const sum = churn.get(month) ?? { added: 0, deleted: 0 };
    churn.set(month, {
      added: sum.added + week.added,
      deleted: sum.deleted + week.deleted,
    });
  }
  return months.map(({ month, commits }) => {
    const [start, end] = monthSpan(month);
    const { added = 0, deleted = 0 } = churn.get(month) ?? {};
    return { label: formatMonth(month), start, end, commits, added, deleted };
  });
};

/**
 * The buckets to draw for a plot `plotWidth` pixels wide: weeks while every
 * bar stays at least 2 px wide, otherwise months.
 */
export const bucketActivity = (
  activity: Activity,
  plotWidth: number,
): { resolution: Resolution; buckets: Bucket[] } =>
  activity.weeks.length > 0 && plotWidth / activity.weeks.length >= MIN_BAR_STEP
    ? { resolution: "weeks", buckets: weekBuckets(activity) }
    : { resolution: "months", buckets: monthBuckets(activity) };

/** The UTC milliseconds from the first span's start to the last span's end, or null without any span. */
export const spanOf = (
  spans: readonly (readonly [number, number])[],
): readonly [number, number] | null =>
  spans.length === 0
    ? null
    : [
        Math.min(...spans.map(([start]) => start)),
        Math.max(...spans.map(([, end]) => end)),
      ];

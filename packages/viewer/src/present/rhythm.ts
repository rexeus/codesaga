import type { Report } from "@codesaga/engine";

type Punchcard = Report["punchcard"];

const HOURS = 24;
const SATURDAY = 5;
const NIGHT_FROM = 22;
const NIGHT_TO = 5;

/** Hours between 22:00 and 05:00 local time, the night of the highlights. */
export const isNightHour = (hour: number): boolean =>
  hour >= NIGHT_FROM || hour < NIGHT_TO;

/** Whether a punchcard row (0 = Monday) is a Saturday or a Sunday. */
export const isWeekend = (weekday: number): boolean => weekday >= SATURDAY;

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** Commits per weekday, Monday first. */
export const weekdayTotals = (punchcard: Punchcard): number[] =>
  punchcard.map((row) => sum(row));

/** Commits per hour of the day, summed over the weekdays. */
export const hourTotals = (punchcard: Punchcard): number[] =>
  Array.from({ length: HOURS }, (_, hour) =>
    sum(punchcard.map((row) => row[hour] ?? 0)),
  );

/** The rhythm of the week: how much happens on weekends and at night, and at which hour most does. */
export type Rhythm = {
  /** Share (0 to 1) of the commits on a Saturday or Sunday. */
  readonly weekendShare: number;
  /** Share (0 to 1) of the commits from 22:00 to 05:00. */
  readonly nightShare: number;
  readonly busiestHour: number;
};

/** The rhythm of a punchcard, or null without any commit. */
export const rhythmOf = (punchcard: Punchcard): Rhythm | null => {
  const hours = hourTotals(punchcard);
  const total = sum(hours);
  if (total === 0) {
    return null;
  }
  const weekend = sum(
    weekdayTotals(punchcard).filter((_, weekday) => isWeekend(weekday)),
  );
  const night = sum(hours.filter((_, hour) => isNightHour(hour)));
  return {
    weekendShare: weekend / total,
    nightShare: night / total,
    busiestHour: hours.indexOf(Math.max(...hours)),
  };
};

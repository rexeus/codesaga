import type { Report } from "@codesaga/engine";

type Punchcard = Report["punchcard"];

const HOURS = 24;
const SATURDAY = 5;

/** The night as the report defines it: from this local hour up to, not including, that one. */
export type NightWindow = {
  readonly nightFromHour: number;
  readonly nightToHour: number;
};

/** A test for the local hours of the night; the window may cross midnight. */
export const isNightHour =
  ({ nightFromHour, nightToHour }: NightWindow) =>
  (hour: number): boolean =>
    nightFromHour <= nightToHour
      ? hour >= nightFromHour && hour < nightToHour
      : hour >= nightFromHour || hour < nightToHour;

const clock = (hour: number): string => `${String(hour).padStart(2, "0")}:00`;

/** The night as clock times, such as "22:00 to 05:00". */
export const nightLabel = ({
  nightFromHour,
  nightToHour,
}: NightWindow): string => `${clock(nightFromHour)} to ${clock(nightToHour)}`;

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
  /** Share (0 to 1) of the commits in the night window. */
  readonly nightShare: number;
  readonly busiestHour: number;
};

/** The rhythm of a punchcard against the report's night window, or null without any commit. */
export const rhythmOf = (
  punchcard: Punchcard,
  night: NightWindow,
): Rhythm | null => {
  const hours = hourTotals(punchcard);
  const total = sum(hours);
  if (total === 0) {
    return null;
  }
  const weekend = sum(
    weekdayTotals(punchcard).filter((_, weekday) => isWeekend(weekday)),
  );
  const isNight = isNightHour(night);
  const nightCommits = sum(hours.filter((_, hour) => isNight(hour)));
  return {
    weekendShare: weekend / total,
    nightShare: nightCommits / total,
    busiestHour: hours.indexOf(Math.max(...hours)),
  };
};

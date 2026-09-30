// Owns how counts, shares and durations read in the terminal view.

const MS_PER_DAY = 86_400_000;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

/** A whole number with thousands separators, e.g. `4412` becomes `4,412`. */
export const count = (value: number): string => value.toLocaleString("en-US");

/** `1 commit`, `2 commits`. */
export const plural = (value: number, unit: string): string =>
  `${count(value)} ${unit}${value === 1 ? "" : "s"}`;

/** `part` as a whole percentage of `whole`, `<1%` for a small non-zero share and `0%` for none. */
export const share = (part: number, whole: number): string => {
  const percent = whole === 0 ? 0 : (part / whole) * 100;
  return percent > 0 && percent < 0.5 ? "<1%" : `${Math.round(percent)}%`;
};

/** Whole days from one ISO timestamp to a later one. */
export const daysBetween = (from: string, to: string): number =>
  Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / MS_PER_DAY));

/** The largest whole unit of a number of days: `3 years`, `5 months`, `12 days`. */
export const span = (days: number): string => {
  if (days >= DAYS_PER_YEAR) {
    return plural(Math.floor(days / DAYS_PER_YEAR), "year");
  }
  return days >= DAYS_PER_MONTH
    ? plural(Math.floor(days / DAYS_PER_MONTH), "month")
    : plural(days, "day");
};

/** How long before `now` an ISO timestamp lies: `today`, `3 days ago`, `2 years ago`. */
export const ago = (timestamp: string, now: string): string => {
  const days = daysBetween(timestamp, now);
  return days === 0 ? "today" : `${span(days)} ago`;
};

const LEVELS = "▁▂▃▄▅▆▇█";

/** One block per value, as tall as its share of the largest value; all-zero input stays flat. */
export const sparkline = (values: ReadonlyArray<number>): string => {
  const max = Math.max(0, ...values);
  return values
    .map((value) =>
      max === 0
        ? LEVELS[0]
        : LEVELS[Math.round((value / max) * (LEVELS.length - 1))],
    )
    .join("");
};

/** The date part of an ISO timestamp: `2026-03-10`. */
export const day = (timestamp: string): string => timestamp.slice(0, 10);

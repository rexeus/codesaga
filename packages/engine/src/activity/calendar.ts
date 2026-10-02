// Owns calendar-month arithmetic in UTC: moving an instant by whole months and counting the whole months between two.
// Badges and highlights measure "6 months" on the calendar, not as a fixed number of days.

const MILLISECONDS_PER_SECOND = 1000;

/**
 * `seconds` moved by `months` calendar months (negative goes back), in UTC and
 * in seconds since the epoch. A day missing from the target month becomes
 * that month's last day.
 */
export const addMonths = (seconds: number, months: number): number => {
  const moved = new Date(seconds * MILLISECONDS_PER_SECOND);
  const day = moved.getUTCDate();
  moved.setUTCDate(1);
  moved.setUTCMonth(moved.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(moved.getUTCFullYear(), moved.getUTCMonth() + 1, 0),
  ).getUTCDate();
  moved.setUTCDate(Math.min(day, lastDay));
  return moved.getTime() / MILLISECONDS_PER_SECOND;
};

/** The whole calendar months from `from` to `to`, both in seconds since the epoch; 0 when `to` is not later. */
export const monthsBetween = (from: number, to: number): number => {
  const start = new Date(from * MILLISECONDS_PER_SECOND);
  const end = new Date(to * MILLISECONDS_PER_SECOND);
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    start.getUTCMonth();
  const whole = addMonths(from, months) > to ? months - 1 : months;
  return Math.max(0, whole);
};

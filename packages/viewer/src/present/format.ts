const counts = new Intl.NumberFormat("en");

/** An integer with thousands separators: `60,942`. */
export const formatCount = (value: number): string => counts.format(value);

/** A share between 0 and 1 as a whole percent: `0.4 → "40%"`. */
export const formatPercent = (share: number): string =>
  `${Math.round(share * 100)}%`;

const signed = (value: number, unit: string): string => {
  if (value === 0) {
    return `0${unit}`;
  }
  const magnitude = formatCount(Math.abs(value));
  return `${value > 0 ? "+" : "\u2212"}${magnitude}${unit}`;
};

/** A difference of counts with its sign: `+2`, `−3`, `0`. */
export const formatSignedCount = (value: number): string => signed(value, "");

/** A relative change as a whole percent with its sign: `0.183 → "+18%"`. */
export const formatSignedPercent = (ratio: number): string =>
  signed(Math.round(ratio * 100), "%");

/** A difference of two shares in whole percentage points: `0.044 → "+4 pts"`. */
export const formatSignedPoints = (fraction: number): string =>
  signed(Math.round(fraction * 100), " pts");

/** The `YYYY-MM-DD` part of an ISO timestamp. */
export const formatDate = (timestamp: string): string => timestamp.slice(0, 10);

const MONTHS_PER_YEAR = 12;
const MS_PER_DAY = 86_400_000;

const monthsBetween = (from: Date, to: Date): number => {
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * MONTHS_PER_YEAR +
    (to.getUTCMonth() - from.getUTCMonth());
  return to.getUTCDate() < from.getUTCDate() ? months - 1 : months;
};

/**
 * The time from `from` to `to` in its largest whole units: `2y 11m`, `3y`,
 * `5 months`, or `12 days`. A reversed range reads as `0 days`.
 */
export const formatAge = (from: string, to: string): string => {
  const [start, end] = [new Date(from), new Date(to)];
  const months = monthsBetween(start, end);
  if (months >= MONTHS_PER_YEAR) {
    const years = Math.floor(months / MONTHS_PER_YEAR);
    const rest = months % MONTHS_PER_YEAR;
    return rest === 0 ? `${years}y` : `${years}y ${rest}m`;
  }
  if (months >= 1) {
    return `${months} ${months === 1 ? "month" : "months"}`;
  }
  const days = Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY),
  );
  return `${days} ${days === 1 ? "day" : "days"}`;
};

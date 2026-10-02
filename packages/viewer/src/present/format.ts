const counts = new Intl.NumberFormat("en");

/** An integer with thousands separators: `60,942`. */
export const formatCount = (value: number): string => counts.format(value);

const MINUS = "−";
const THOUSAND = 1000;
const MILLION = 1_000_000;
const SHORT_FROM = 10_000;

/** A count in the shortest readable form: `950`, `1.5k`, `12k`, `3.2M`. */
export const formatCompact = (value: number): string => {
  const magnitude = Math.abs(value);
  const scaled = (divisor: number, digits: number, unit: string): string =>
    `${(magnitude / divisor).toFixed(digits).replace(/\.0$/u, "")}${unit}`;
  if (magnitude >= MILLION) {
    return scaled(MILLION, 1, "M");
  }
  if (magnitude >= THOUSAND) {
    return scaled(THOUSAND, magnitude >= SHORT_FROM ? 0 : 1, "k");
  }
  return String(Math.round(magnitude));
};

/** A compact count with its sign; zero stays bare: `+5k`, `−10k`, `0`. */
export const formatSignedCompact = (value: number): string => {
  if (value === 0) {
    return "0";
  }
  return `${value > 0 ? "+" : MINUS}${formatCompact(value)}`;
};

/** A share between 0 and 1 as a whole percent: `0.4 → "40%"`. */
export const formatPercent = (share: number): string =>
  `${Math.round(share * 100)}%`;

const signed = (value: number, unit: string): string => {
  if (value === 0) {
    return `0${unit}`;
  }
  const magnitude = formatCount(Math.abs(value));
  return `${value > 0 ? "+" : MINUS}${magnitude}${unit}`;
};

/** A difference of counts with its sign: `+2`, `−3`, `0`. */
export const formatSignedCount = (value: number): string => signed(value, "");

/** A relative change as a whole percent with its sign: `0.183 → "+18%"`. */
export const formatSignedPercent = (ratio: number): string =>
  signed(Math.round(ratio * 100), "%");

/** The `YYYY-MM-DD` part of an ISO timestamp. */
export const formatDate = (timestamp: string): string => timestamp.slice(0, 10);

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const monthName = (isoMonth: string): string =>
  MONTH_NAMES[Number(isoMonth) - 1] ?? "";

/** The date of an ISO timestamp as people write it: `19 May 2025`. */
export const formatDateLong = (timestamp: string): string =>
  `${Number(timestamp.slice(8, 10))} ${monthName(timestamp.slice(5, 7))} ${timestamp.slice(0, 4)}`;

/** The month of an ISO timestamp or of `YYYY-MM`: `May 2025`. */
export const formatMonth = (timestamp: string): string =>
  `${monthName(timestamp.slice(5, 7))} ${timestamp.slice(0, 4)}`;

const MONTHS_PER_YEAR = 12;
const MS_PER_DAY = 86_400_000;

const plural = (count: number, unit: string): string =>
  `${count} ${unit}${count === 1 ? "" : "s"}`;

const monthsBetween = (from: Date, to: Date): number => {
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * MONTHS_PER_YEAR +
    (to.getUTCMonth() - from.getUTCMonth());
  return to.getUTCDate() < from.getUTCDate() ? months - 1 : months;
};

const MIN_MONTHS_AS_MONTHS = 3;
const DAYS_PER_WEEK = 7;

/**
 * The time from `from` to `to` in words: `1 year and 4 months`, `3 years`,
 * `5 months`, `12 weeks` (under three months) or `5 days` (under a week). A
 * reversed range reads as `0 days`.
 */
export const formatAge = (from: string, to: string): string => {
  const [start, end] = [new Date(from), new Date(to)];
  const months = monthsBetween(start, end);
  if (months >= MONTHS_PER_YEAR) {
    const years = plural(Math.floor(months / MONTHS_PER_YEAR), "year");
    const rest = months % MONTHS_PER_YEAR;
    return rest === 0 ? years : `${years} and ${plural(rest, "month")}`;
  }
  if (months >= MIN_MONTHS_AS_MONTHS) {
    return plural(months, "month");
  }
  const days = Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY),
  );
  return days >= DAYS_PER_WEEK
    ? plural(Math.round(days / DAYS_PER_WEEK), "week")
    : plural(days, "day");
};

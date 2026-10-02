import { scaleLinear, scaleUtc } from "d3-scale";
import type { ScaleLinear } from "d3-scale";

import { formatCompact } from "../present/format.js";
import type { Tick, Zone } from "./plot.js";

const X_TICK_SPACING = 72;
const MONTH_TICK_SPACING = 64;
const MS_PER_DAY = 86_400_000;
const MONTH_STEP = 28 * MS_PER_DAY;
/** Shorter spans are labelled by day, longer ones by month. */
const MONTH_LABELS_FROM = 75 * MS_PER_DAY;

const monthName = new Intl.DateTimeFormat("en", {
  month: "short",
  timeZone: "UTC",
});

const monthAndDay = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** The short month name with its two-digit year: `Jul ’25`. */
const monthTickLabel = (tick: Date): string =>
  `${monthName.format(tick)} ’${String(tick.getUTCFullYear()).slice(2)}`;

/**
 * The first of every month the span touches, the first one clamped to the
 * span's start so the axis opens with the month the data begins in. Months
 * that would crowd the previous label (closer than `minGap` pixels) are left out.
 */
const monthTicks = (
  [start, end]: readonly [number, number],
  x: (timestamp: number) => number,
  minGap: number,
): Tick[] => {
  const ticks: Tick[] = [];
  const first = new Date(start);
  let month = Date.UTC(first.getUTCFullYear(), first.getUTCMonth());
  while (month <= end) {
    const position = x(Math.max(month, start));
    const previous = ticks.at(-1);
    if (previous === undefined || position - previous.position >= minGap) {
      ticks.push({ position, label: monthTickLabel(new Date(month)) });
    }
    const next = new Date(month);
    month = Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1);
  }
  return ticks;
};

/**
 * Ticks a month or more apart read as months; closer ones carry the day, so
 * a short history never repeats one month name along the axis.
 */
const dayTickLabels = (ticks: readonly Date[]): string[] => {
  const [first, second] = ticks;
  const spansMonths =
    first !== undefined &&
    second !== undefined &&
    second.getTime() - first.getTime() >= MONTH_STEP;
  return ticks.map((tick) =>
    spansMonths ? monthTickLabel(tick) : monthAndDay.format(tick),
  );
};

/** A UTC time axis over a plot `width` pixels wide. */
export type TimeAxis = {
  /** The plot x of a UTC timestamp. */
  readonly x: (timestamp: number) => number;
  /** The plot span from `start` to `end`. */
  readonly zone: (start: number, end: number) => Zone;
  readonly ticks: readonly Tick[];
};

/**
 * The axis of the span `[start, end]` in UTC milliseconds: month labels along a
 * span of 75 days or more, day labels along a shorter one.
 */
export const timeAxisOf = (
  [start, end]: readonly [number, number],
  width: number,
): TimeAxis => {
  const scale = scaleUtc()
    .domain([new Date(start), new Date(end)])
    .range([0, width]);
  const x = (timestamp: number): number => scale(new Date(timestamp));
  const zone: TimeAxis["zone"] = (from, to) => ({
    x: x(from),
    width: x(to) - x(from),
  });
  if (end - start >= MONTH_LABELS_FROM) {
    return { x, zone, ticks: monthTicks([start, end], x, MONTH_TICK_SPACING) };
  }
  const ticks = scale.ticks(Math.max(2, Math.floor(width / X_TICK_SPACING)));
  const labels = dayTickLabels(ticks);
  return {
    x,
    zone,
    ticks: ticks.map((tick, index) => ({
      position: scale(tick),
      label: labels[index] ?? "",
    })),
  };
};

/** A linear count scale from 0 (or a symmetric range) to the plot top, rounded to clean ticks. */
export const countScale = (
  [low, high]: readonly [number, number],
  height: number,
): ScaleLinear<number, number> =>
  scaleLinear().domain([low, high]).nice().range([height, 0]);

/**
 * Labelled ticks of a count scale, written by `label` (compact counts
 * by default). Only whole numbers get a tick, since the scale counts commits and
 * people.
 */
export const countTicks = (
  scale: ScaleLinear<number, number>,
  count: number,
  label: (value: number) => string = formatCompact,
): Tick[] =>
  scale
    .ticks(count)
    .filter((value) => Number.isInteger(value))
    .map((value) => ({
      position: scale(value),
      label: label(value),
    }));

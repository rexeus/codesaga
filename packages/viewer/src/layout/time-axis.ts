import { scaleLinear, scaleUtc } from "d3-scale";
import type { ScaleLinear } from "d3-scale";

import { formatCount } from "../present/format.js";
import type { Tick, Zone } from "./plot.js";

const X_TICK_SPACING = 90;

const MS_PER_DAY = 86_400_000;
const MONTH_STEP = 28 * MS_PER_DAY;

const monthName = new Intl.DateTimeFormat("en", {
  month: "short",
  timeZone: "UTC",
});

const monthAndDay = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** The year on the first of January, the short month name on any other tick. */
const monthTickLabel = (tick: Date): string =>
  tick.getUTCMonth() === 0 && tick.getUTCDate() === 1
    ? String(tick.getUTCFullYear())
    : monthName.format(tick);

/**
 * Ticks a month or more apart read as months; closer ones carry the day, so
 * a short history never repeats one month name along the axis.
 */
const timeTickLabels = (ticks: readonly Date[]): string[] => {
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

export const timeAxisOf = (
  [start, end]: readonly [number, number],
  width: number,
): TimeAxis => {
  const scale = scaleUtc()
    .domain([new Date(start), new Date(end)])
    .range([0, width]);
  const x = (timestamp: number): number => scale(new Date(timestamp));
  const count = Math.max(2, Math.floor(width / X_TICK_SPACING));
  const ticks = scale.ticks(count);
  const labels = timeTickLabels(ticks);
  return {
    x,
    zone: (from, to) => ({ x: x(from), width: x(to) - x(from) }),
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
 * Labelled ticks of a count scale; negative values read as their magnitude.
 * Only whole numbers get a tick, since the scale counts commits and people.
 */
export const countTicks = (
  scale: ScaleLinear<number, number>,
  count: number,
): Tick[] =>
  scale
    .ticks(count)
    .filter((value) => Number.isInteger(value))
    .map((value) => ({
      position: scale(value),
      label: formatCount(Math.abs(value)),
    }));

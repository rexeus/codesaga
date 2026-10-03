import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";

import { plotSize } from "./plot.js";
import type { Size, Tick, Zone } from "./plot.js";
import { timeAxisOf } from "./time-axis.js";

const Y_TICKS = 3;

/** How a line's value axis is written. */
export type TrendAxis = {
  /** The tick's text, given the value and the fraction digits its step needs. */
  readonly label: (value: number, digits: number) => string;
  /** True for a count: only whole numbers get a tick. */
  readonly whole: boolean;
};

/** The fraction digits that tell ticks `step` apart: none for a step of 1 or more, one for 0.5 or 0.1, two for 0.05. */
const digitsOf = (step: number): number =>
  step >= 1 ? 0 : Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));

/** A month of the series as a point in plot pixels; `y` is null where the series has no value. */
type TrendPoint = {
  readonly x: number;
  readonly y: number | null;
};

/** A line chart of one value per month in pixels of its plotting area. */
export type TrendLayout = {
  readonly plot: Size;
  readonly points: readonly TrendPoint[];
  /** The line as an SVG path, broken where the series has no value; empty without two neighbouring values. */
  readonly path: string;
  /** The points to draw a dot on: the last one, and every value with no neighbour to join to. */
  readonly dots: readonly { readonly x: number; readonly y: number }[];
  /** The value axis. */
  readonly ticks: readonly Tick[];
  /** The month labels. */
  readonly timeTicks: readonly Tick[];
  /** One zone per month, each as wide as the space between its neighbours' midpoints. */
  readonly zones: readonly Zone[];
  /** The plot y of zero, where the baseline sits. */
  readonly zero: number;
};

const present = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined;

const monthStart = (month: string): number =>
  Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1);

const zonesOf = (xs: readonly number[], width: number): Zone[] =>
  xs.map((x, index) => {
    const before = xs[index - 1];
    const after = xs[index + 1];
    const from = before === undefined ? 0 : (before + x) / 2;
    const to = after === undefined ? width : (x + after) / 2;
    return { x: from, width: to - from };
  });

const dotsOf = (points: readonly TrendPoint[]): TrendLayout["dots"][number][] =>
  points.flatMap(({ x, y }, index) => {
    if (y === null) {
      return [];
    }
    const alone =
      !present(points[index - 1]?.y) && !present(points[index + 1]?.y);
    return alone || index === points.length - 1 ? [{ x, y }] : [];
  });

const ticksOf = (
  values: readonly number[],
  { label, whole }: TrendAxis,
): { value: number; label: string }[] => {
  const shown = whole
    ? values.filter((value) => Number.isInteger(value))
    : values;
  const [first, second] = values;
  const step = first === undefined || second === undefined ? 1 : second - first;
  const digits = whole ? 0 : digitsOf(step);
  return shown.map((value) => ({ value, label: label(value, digits) }));
};

/**
 * Lays one value per month out as a line of `size`, from zero up to the
 * highest value, with the months spread by date. A month without a value
 * (`null`) breaks the line. Null for fewer than two months, which have no
 * line to draw. The axis ticks are written with the fraction digits their
 * step needs, so two ticks never read alike.
 */
export const layoutTrend = (
  months: readonly string[],
  values: readonly (number | null)[],
  size: Size,
  valueAxis: TrendAxis,
): TrendLayout | null => {
  const first = months[0];
  const last = months.at(-1);
  if (first === undefined || last === undefined || months.length < 2) {
    return null;
  }
  const plot = plotSize(size);
  const axis = timeAxisOf([monthStart(first), monthStart(last)], plot.width);
  const highest = Math.max(0, ...values.map((value) => value ?? 0));
  const y = scaleLinear()
    .domain([0, highest === 0 ? 1 : highest])
    .nice()
    .range([plot.height, 0]);
  const points = months.map((month, index): TrendPoint => ({
    x: axis.x(monthStart(month)),
    y: present(values[index]) ? y(values[index] ?? 0) : null,
  }));
  const joined = points.some(
    (point, index) => point.y !== null && present(points[index + 1]?.y),
  );
  const path = joined
    ? (line<TrendPoint>()
        .defined((point) => point.y !== null)
        .x((point) => point.x)
        .y((point) => point.y ?? 0)(points) ?? "")
    : "";
  return {
    plot,
    points,
    path,
    dots: dotsOf(points),
    ticks: ticksOf(y.ticks(Y_TICKS), valueAxis).map(({ value, label }) => ({
      position: y(value),
      label,
    })),
    timeTicks: axis.ticks,
    zones: zonesOf(
      points.map(({ x }) => x),
      plot.width,
    ),
    zero: plot.height,
  };
};

import type { Report } from "@codesaga/engine";
import { scaleLinear, scaleUtc } from "d3-scale";
import type { ScaleLinear } from "d3-scale";
import { area, curveMonotoneX, line } from "d3-shape";

import { formatCount } from "../present/format.js";
import { BAR_RADIUS } from "./bar-path.js";
import type { Bar } from "./bar-path.js";
import { plotSize } from "./plot.js";
import type { Size, Tick, Zone } from "./plot.js";
import { bucketActivity, monthSpan, timeDomain } from "./time-buckets.js";
import type { Bucket, Resolution } from "./time-buckets.js";

const MAX_BAR_WIDTH = 24;
const BAR_GAP = 2;
const MIN_GAPPED_STEP = 6;
const Y_TICKS = 4;
const MIRRORED_Y_TICKS = 6;
const X_TICK_SPACING = 90;

/** A month's active contributors as a point of the line. */
type ContributorPoint = {
  readonly x: number;
  readonly y: number;
  readonly month: string;
  readonly contributors: number;
};

/**
 * Every mark of the activity section in plot pixels, so the three charts share
 * one time axis. `zones[i]` is the hover span of `buckets[i]`.
 */
export type ActivityLayout = {
  readonly plot: Size;
  readonly resolution: Resolution;
  readonly buckets: readonly Bucket[];
  readonly zones: readonly Zone[];
  readonly timeTicks: readonly Tick[];
  readonly commits: { readonly bars: Bar[]; readonly ticks: Tick[] };
  /** Lines added rise above `zero`, lines deleted hang below it, on one scale. */
  readonly churn: {
    readonly added: Bar[];
    readonly deleted: Bar[];
    readonly ticks: Tick[];
    readonly zero: number;
  };
  readonly contributors: {
    readonly points: ContributorPoint[];
    readonly zones: Zone[];
    readonly line: string;
    readonly area: string;
    readonly ticks: Tick[];
  };
};

const monthName = new Intl.DateTimeFormat("en", {
  month: "short",
  timeZone: "UTC",
});

/** The year on the first of January, the short month name on any other tick. */
const timeTickLabel = (tick: Date): string =>
  tick.getUTCMonth() === 0 && tick.getUTCDate() === 1
    ? String(tick.getUTCFullYear())
    : monthName.format(tick);

type TimeScale = (value: Date) => number;

const countTicks = (
  scale: ScaleLinear<number, number>,
  count: number,
): Tick[] =>
  scale.ticks(count).map((value) => ({
    position: scale(value),
    label: formatCount(Math.abs(value)),
  }));

const spanOf = (x: TimeScale, { start, end }: Bucket): Zone => {
  const left = x(new Date(start));
  return { x: left, width: x(new Date(end)) - left };
};

/** A thin bar centred in its zone; it never fills the whole slot. */
const barSlot = ({ x, width }: Zone): { x: number; width: number } => {
  const gap = width >= MIN_GAPPED_STEP ? BAR_GAP : 0;
  const barWidth = Math.max(1, Math.min(MAX_BAR_WIDTH, width - gap));
  return { x: x + (width - barWidth) / 2, width: barWidth };
};

const bar = (
  zone: Zone,
  top: number,
  bottom: number,
  direction: Bar["direction"],
): Bar => {
  const slot = barSlot(zone);
  const height = bottom - top;
  return {
    ...slot,
    y: top,
    height,
    radius: Math.min(BAR_RADIUS, slot.width / 2, height),
    direction,
  };
};

const commitsChart = (
  buckets: readonly Bucket[],
  zones: readonly Zone[],
  height: number,
): ActivityLayout["commits"] => {
  const max = Math.max(1, ...buckets.map(({ commits }) => commits));
  const y = scaleLinear().domain([0, max]).nice().range([height, 0]);
  return {
    bars: buckets.map(({ commits }, index) =>
      bar(zones[index] ?? { x: 0, width: 0 }, y(commits), height, "up"),
    ),
    ticks: countTicks(y, Y_TICKS),
  };
};

const churnChart = (
  buckets: readonly Bucket[],
  zones: readonly Zone[],
  height: number,
): ActivityLayout["churn"] => {
  const extent = Math.max(
    1,
    ...buckets.map(({ added, deleted }) => Math.max(added, deleted)),
  );
  const y = scaleLinear().domain([-extent, extent]).nice().range([height, 0]);
  const zero = y(0);
  const zoneAt = (index: number): Zone => zones[index] ?? { x: 0, width: 0 };
  return {
    added: buckets.map(({ added }, index) =>
      bar(zoneAt(index), y(added), zero, "up"),
    ),
    deleted: buckets.map(({ deleted }, index) =>
      bar(zoneAt(index), zero, y(-deleted), "down"),
    ),
    ticks: countTicks(y, MIRRORED_Y_TICKS),
    zero,
  };
};

const contributorsChart = (
  months: Report["activity"]["months"],
  x: TimeScale,
  height: number,
): ActivityLayout["contributors"] => {
  const max = Math.max(1, ...months.map(({ contributors }) => contributors));
  const y = scaleLinear().domain([0, max]).nice().range([height, 0]);
  const points = months.map(({ month, contributors }) => {
    const [start, end] = monthSpan(month);
    return {
      x: x(new Date((start + end) / 2)),
      y: y(contributors),
      month,
      contributors,
    };
  });
  const coordinates = points.map(({ x: px, y: py }): [number, number] => [
    px,
    py,
  ]);
  const curve = curveMonotoneX;
  return {
    points,
    zones: months.map(({ month }) => {
      const [start, end] = monthSpan(month);
      const left = x(new Date(start));
      return { x: left, width: x(new Date(end)) - left };
    }),
    line: line().curve(curve)(coordinates) ?? "",
    area:
      area()
        .curve(curve)
        .x(([px]) => px)
        .y0(height)
        .y1(([, py]) => py)(coordinates) ?? "",
    ticks: countTicks(y, Y_TICKS),
  };
};

/**
 * Lays out commits per bucket, lines added and deleted per bucket and active
 * contributors per month for a chart of `size`. Returns null for a report
 * without any week or month.
 */
export const layoutActivity = (
  activity: Report["activity"],
  size: Size,
): ActivityLayout | null => {
  const domain = timeDomain(activity);
  if (domain === null) {
    return null;
  }
  const plot = plotSize(size);
  const scale = scaleUtc()
    .domain([new Date(domain[0]), new Date(domain[1])])
    .range([0, plot.width]);
  const x: TimeScale = (value) => scale(value);
  const { resolution, buckets } = bucketActivity(activity, plot.width);
  const zones = buckets.map((bucket) => spanOf(x, bucket));
  const tickCount = Math.max(2, Math.floor(plot.width / X_TICK_SPACING));
  return {
    plot,
    resolution,
    buckets,
    zones,
    timeTicks: scale
      .ticks(tickCount)
      .map((tick) => ({ position: x(tick), label: timeTickLabel(tick) })),
    commits: commitsChart(buckets, zones, plot.height),
    churn: churnChart(buckets, zones, plot.height),
    contributors: contributorsChart(activity.months, x, plot.height),
  };
};

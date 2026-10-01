import type { Report } from "@codesaga/engine";
import { area, curveMonotoneX, line } from "d3-shape";

import { barInZone } from "./bars.js";
import type { Bar } from "./bars.js";
import { plotSize } from "./plot.js";
import type { Size, Tick, Zone } from "./plot.js";
import { countScale, countTicks, timeAxisOf } from "./time-axis.js";
import type { TimeAxis } from "./time-axis.js";
import { bucketActivity, monthSpan, timeDomain } from "./time-buckets.js";
import type { Bucket, Resolution } from "./time-buckets.js";

const Y_TICKS = 4;
const MIRRORED_Y_TICKS = 6;

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

const NO_ZONE: Zone = { x: 0, width: 0 };

const commitsChart = (
  buckets: readonly Bucket[],
  zones: readonly Zone[],
  height: number,
): ActivityLayout["commits"] => {
  const max = Math.max(1, ...buckets.map(({ commits }) => commits));
  const y = countScale([0, max], height);
  return {
    bars: buckets.map(({ commits }, index) =>
      barInZone(zones[index] ?? NO_ZONE, y(commits), height, "up"),
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
  const y = countScale([-extent, extent], height);
  const zero = y(0);
  return {
    added: buckets.map(({ added }, index) =>
      barInZone(zones[index] ?? NO_ZONE, y(added), zero, "up"),
    ),
    deleted: buckets.map(({ deleted }, index) =>
      barInZone(zones[index] ?? NO_ZONE, zero, y(-deleted), "down"),
    ),
    ticks: countTicks(y, MIRRORED_Y_TICKS),
    zero,
  };
};

const contributorsChart = (
  months: Report["activity"]["months"],
  axis: TimeAxis,
  height: number,
): ActivityLayout["contributors"] => {
  const max = Math.max(1, ...months.map(({ contributors }) => contributors));
  const y = countScale([0, max], height);
  const spans = months.map(({ month }) => monthSpan(month));
  const points = months.map(({ month, contributors }, index) => {
    const [start, end] = spans[index] ?? [0, 0];
    return {
      x: axis.x((start + end) / 2),
      y: y(contributors),
      month,
      contributors,
    };
  });
  const coordinates = points.map(({ x, y: py }): [number, number] => [x, py]);
  return {
    points,
    zones: spans.map(([start, end]) => axis.zone(start, end)),
    line: line().curve(curveMonotoneX)(coordinates) ?? "",
    area:
      area()
        .curve(curveMonotoneX)
        .x(([x]) => x)
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
  const axis = timeAxisOf(domain, plot.width);
  const { resolution, buckets } = bucketActivity(activity, plot.width);
  const zones = buckets.map(({ start, end }) => axis.zone(start, end));
  return {
    plot,
    resolution,
    buckets,
    zones,
    timeTicks: axis.ticks,
    commits: commitsChart(buckets, zones, plot.height),
    churn: churnChart(buckets, zones, plot.height),
    contributors: contributorsChart(activity.months, axis, plot.height),
  };
};

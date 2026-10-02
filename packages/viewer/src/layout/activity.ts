import type { Report } from "@codesaga/engine";

import { formatMonth, formatSignedCompact } from "../present/format.js";
import { barInZone } from "./bars.js";
import type { Bar } from "./bars.js";
import { plotSize } from "./plot.js";
import type { Size, Tick, Zone } from "./plot.js";
import { countScale, countTicks, timeAxisOf } from "./time-axis.js";
import { bucketActivity, monthSpan, spanOf } from "./time-buckets.js";
import type { Bucket, Resolution } from "./time-buckets.js";

const Y_TICKS = 4;
const MIRRORED_Y_TICKS = 6;
const COMMIT_BAR_WIDTH = 16;
const NARROW_BAR_WIDTH = 12;
/** Weeks emphasised as the recent part of the commit bars, and the history they need to stand out from. */
const RECENT_BUCKETS = 12;
const MIN_BUCKETS_FOR_RECENT = 26;

/** A month's active contributors as a bar. */
type ContributorBar = {
  readonly bar: Bar;
  readonly month: string;
  readonly contributors: number;
};

/** The bucket with the most commits, where the chart prints its peak. */
type Peak = {
  /** The bar's centre in plot pixels. */
  readonly x: number;
  readonly y: number;
  readonly commits: number;
  /** Which way the label extends so it stays inside the chart. */
  readonly anchor: "start" | "middle" | "end";
};

/**
 * Every mark of the activity charts in plot pixels. The commit and line charts
 * share one time axis over the buckets, so `zones[i]` is the hover span of
 * `buckets[i]` in both; the contributors chart has its own over the months.
 */
export type ActivityLayout = {
  readonly plot: Size;
  readonly resolution: Resolution;
  readonly buckets: readonly Bucket[];
  readonly zones: readonly Zone[];
  readonly timeTicks: readonly Tick[];
  readonly commits: {
    readonly bars: Bar[];
    readonly ticks: Tick[];
    /** The first bucket of the emphasised recent part; null when the history is too short to tell it apart. */
    readonly recentFrom: number | null;
    readonly peak: Peak | null;
    /** The mean commits per bucket and its plot y. */
    readonly average: { readonly value: number; readonly y: number };
  };
  /** Lines added rise above `zero`, lines deleted hang below it, on one scale. */
  readonly churn: {
    readonly added: Bar[];
    readonly deleted: Bar[];
    readonly ticks: Tick[];
    readonly zero: number;
  };
  readonly contributors: {
    readonly bars: ContributorBar[];
    readonly zones: Zone[];
    readonly ticks: Tick[];
    readonly timeTicks: readonly Tick[];
  };
};

const NO_ZONE: Zone = { x: 0, width: 0 };
/** A label of the peak needs this much room on its side of the bar. */
const LABEL_ROOM = 60;

const anchorAt = (x: number, width: number): Peak["anchor"] => {
  if (x < LABEL_ROOM) {
    return "start";
  }
  return x > width - LABEL_ROOM ? "end" : "middle";
};

const peakOf = (
  buckets: readonly Bucket[],
  bars: readonly Bar[],
  width: number,
): Peak | null => {
  const commits = Math.max(...buckets.map((bucket) => bucket.commits));
  const index = buckets.findIndex((bucket) => bucket.commits === commits);
  const bar = bars[index];
  if (bar === undefined || commits === 0) {
    return null;
  }
  const x = bar.x + bar.width / 2;
  return { x, y: bar.y, commits, anchor: anchorAt(x, width) };
};

const commitsChart = (
  buckets: readonly Bucket[],
  zones: readonly Zone[],
  plot: Size,
  resolution: Resolution,
): ActivityLayout["commits"] => {
  const max = Math.max(1, ...buckets.map(({ commits }) => commits));
  const y = countScale([0, max], plot.height);
  const bars = buckets.map(({ commits }, index) =>
    barInZone(
      zones[index] ?? NO_ZONE,
      [y(commits), plot.height],
      "up",
      COMMIT_BAR_WIDTH,
    ),
  );
  const mean =
    buckets.reduce((total, { commits }) => total + commits, 0) /
    Math.max(1, buckets.length);
  const emphasised =
    resolution === "weeks" && buckets.length >= MIN_BUCKETS_FOR_RECENT;
  return {
    bars,
    ticks: countTicks(y, Y_TICKS),
    recentFrom: emphasised ? buckets.length - RECENT_BUCKETS : null,
    peak: peakOf(buckets, bars, plot.width),
    average: { value: mean, y: y(mean) },
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
  const bar = (
    index: number,
    top: number,
    bottom: number,
    direction: Bar["direction"],
  ): Bar =>
    barInZone(
      zones[index] ?? NO_ZONE,
      [top, bottom],
      direction,
      NARROW_BAR_WIDTH,
    );
  return {
    added: buckets.map(({ added }, index) => bar(index, y(added), zero, "up")),
    deleted: buckets.map(({ deleted }, index) =>
      bar(index, zero, y(-deleted), "down"),
    ),
    ticks: countTicks(y, MIRRORED_Y_TICKS, formatSignedCompact),
    zero,
  };
};

const contributorsChart = (
  months: Report["activity"]["months"],
  plot: Size,
): ActivityLayout["contributors"] => {
  const spans = months.map(({ month }) => monthSpan(month));
  const domain = spanOf(spans);
  if (domain === null) {
    return { bars: [], zones: [], ticks: [], timeTicks: [] };
  }
  const axis = timeAxisOf(domain, plot.width);
  const max = Math.max(1, ...months.map(({ contributors }) => contributors));
  const y = countScale([0, max], plot.height);
  const zones = spans.map(([start, end]) => axis.zone(start, end));
  return {
    zones,
    bars: months.map(({ month, contributors }, index) => ({
      bar: barInZone(
        zones[index] ?? NO_ZONE,
        [y(contributors), plot.height],
        "up",
        NARROW_BAR_WIDTH,
      ),
      month: formatMonth(month),
      contributors,
    })),
    ticks: countTicks(y, Y_TICKS),
    timeTicks: axis.ticks,
  };
};

/**
 * Lays out commits per bucket, lines added and deleted per bucket and active
 * contributors per month for a chart of `size`. The commit and line charts
 * share one time axis over their buckets, the contributors chart has its own
 * over its months. Returns null for a report without any week or month.
 */
export const layoutActivity = (
  activity: Report["activity"],
  size: Size,
): ActivityLayout | null => {
  const plot = plotSize(size);
  const { resolution, buckets } = bucketActivity(activity, plot.width);
  const domain = spanOf(buckets.map(({ start, end }) => [start, end]));
  if (domain === null) {
    return null;
  }
  const axis = timeAxisOf(domain, plot.width);
  const zones = buckets.map(({ start, end }) => axis.zone(start, end));
  return {
    plot,
    resolution,
    buckets,
    zones,
    timeTicks: axis.ticks,
    commits: commitsChart(buckets, zones, plot, resolution),
    churn: churnChart(buckets, zones, plot.height),
    contributors: contributorsChart(activity.months, plot),
  };
};

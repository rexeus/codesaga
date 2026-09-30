import type { Report } from "@codesaga/engine";

import { AUTOMATION_CLASSES } from "../present/automation.js";
import { barInZone } from "./bars.js";
import type { Bar } from "./bars.js";
import { plotSize } from "./plot.js";
import type { Size, Tick, Zone } from "./plot.js";
import { countScale, countTicks, timeAxisOf } from "./time-axis.js";
import { monthSpan } from "./time-buckets.js";

const SEGMENT_GAP = 2;
const Y_TICKS = 4;

type Months = Report["automation"]["months"];
type ClassKey = (typeof AUTOMATION_CLASSES)[number]["key"];

/** One class of one month: the commits and the bar that shows them. */
type Segment = Bar & {
  readonly key: ClassKey;
  readonly commits: number;
};

/** A month's stack, bottom to top in `AUTOMATION_CLASSES` order. */
type MonthStack = {
  readonly month: string;
  readonly total: number;
  readonly segments: readonly Segment[];
};

export type AutomationLayout = {
  readonly plot: Size;
  readonly stacks: readonly MonthStack[];
  /** `zones[i]` is the hover span of `stacks[i]`. */
  readonly zones: readonly Zone[];
  readonly ticks: readonly Tick[];
  readonly timeTicks: readonly Tick[];
};

const stackOf = (
  month: Months[number],
  zone: Zone,
  y: (value: number) => number,
): MonthStack => {
  const nonEmpty = AUTOMATION_CLASSES.filter(({ key }) => month[key] > 0);
  const topKey = nonEmpty.at(-1)?.key;
  let below = 0;
  const segments = AUTOMATION_CLASSES.map(({ key }): Segment => {
    const commits = month[key];
    const top = y(below + commits);
    const bottom = y(below);
    below += commits;
    // the surface gap sits between segments, never below the lowest one
    const gap = commits > 0 && below > commits ? SEGMENT_GAP : 0;
    const gapped = Math.min(top + gap, Math.max(top, bottom - 1));
    const bar = barInZone(zone, gapped, bottom, "up");
    // only the top of a stack has a rounded data end
    return { ...bar, radius: key === topKey ? bar.radius : 0, key, commits };
  });
  return { month: month.month, total: below, segments };
};

/**
 * Lays out commits per month stacked by class on a shared time axis. Returns
 * null for a report without months.
 */
export const layoutAutomation = (
  months: Months,
  size: Size,
): AutomationLayout | null => {
  const first = months[0];
  const last = months.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }
  const plot = plotSize(size);
  const axis = timeAxisOf(
    [monthSpan(first.month)[0], monthSpan(last.month)[1]],
    plot.width,
  );
  const zones = months.map(({ month }) => axis.zone(...monthSpan(month)));
  const totals = months.map((month) =>
    AUTOMATION_CLASSES.reduce((sum, { key }) => sum + month[key], 0),
  );
  const y = countScale([0, Math.max(1, ...totals)], plot.height);
  return {
    plot,
    stacks: months.map((month, index) =>
      stackOf(month, zones[index] ?? { x: 0, width: 0 }, y),
    ),
    zones,
    ticks: countTicks(y, Y_TICKS),
    timeTicks: axis.ticks,
  };
};

import type { Report } from "@codesaga/engine";

import { barInZone } from "./bars.js";
import type { Bar } from "./bars.js";
import { plotSize } from "./plot.js";
import type { Size, Tick, Zone } from "./plot.js";
import { countScale, countTicks, timeAxisOf } from "./time-axis.js";
import { monthSpan } from "./time-buckets.js";

const Y_TICKS = 4;

type Months = NonNullable<Report["pullRequests"]>["months"];

/** A month's two bars side by side: opened on the left, merged on the right. */
type MonthPair = {
  readonly month: string;
  readonly opened: number;
  readonly merged: number;
  readonly openedBar: Bar;
  readonly mergedBar: Bar;
};

export type PullRequestsLayout = {
  readonly plot: Size;
  readonly pairs: readonly MonthPair[];
  /** `zones[i]` is the hover span of `pairs[i]`. */
  readonly zones: readonly Zone[];
  readonly ticks: readonly Tick[];
  readonly timeTicks: readonly Tick[];
};

const halves = ({ x, width }: Zone): readonly [Zone, Zone] => [
  { x, width: width / 2 },
  { x: x + width / 2, width: width / 2 },
];

/**
 * Lays out pull requests opened and merged per month on a shared time axis,
 * one bar of each per month. Returns null without months.
 */
export const layoutPullRequests = (
  months: Months,
  size: Size,
): PullRequestsLayout | null => {
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
  const y = countScale(
    [
      0,
      Math.max(1, ...months.flatMap(({ opened, merged }) => [opened, merged])),
    ],
    plot.height,
  );
  const zones = months.map(({ month }) => axis.zone(...monthSpan(month)));
  return {
    plot,
    pairs: months.map(({ month, opened, merged }, index) => {
      const [left, right] = halves(zones[index] ?? { x: 0, width: 0 });
      return {
        month,
        opened,
        merged,
        openedBar: barInZone(left, y(opened), plot.height, "up"),
        mergedBar: barInZone(right, y(merged), plot.height, "up"),
      };
    }),
    zones,
    ticks: countTicks(y, Y_TICKS),
    timeTicks: axis.ticks,
  };
};

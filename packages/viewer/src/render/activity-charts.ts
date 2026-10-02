import type { ActivityLayout } from "../layout/activity.js";
import { barPath } from "../layout/bars.js";
import type { Bar } from "../layout/bars.js";
import { formatCount } from "../present/format.js";
import { timeAxis, valueAxis } from "./chart-frame.js";
import type { Plot } from "./chart-frame.js";
import { s } from "./dom.js";
import { hoverZones } from "./hover.js";

const barMarks = (
  bars: readonly Bar[],
  entity: string,
  earlierThan = 0,
): SVGElement[] =>
  bars.flatMap((bar, index) =>
    bar.height > 0
      ? [
          s("path", {
            class: `mark ${entity}${index < earlierThan ? " earlier" : ""}`,
            d: barPath(bar),
          }),
        ]
      : [],
  );

const baseline = (layout: ActivityLayout, y: number): SVGElement =>
  s("line", { class: "baseline", x1: 0, x2: layout.plot.width, y1: y, y2: y });

const peakLabel = ({ commits }: ActivityLayout): SVGElement[] => {
  const { peak } = commits;
  if (peak === null) {
    return [];
  }
  const label = s("text", {
    class: "annotation",
    x: peak.x,
    y: peak.y - 7,
    "text-anchor": peak.anchor,
  });
  label.textContent = `Peak ${formatCount(peak.commits)}`;
  return [label];
};

/** Commits per week or month: older bars softened, the average dashed, the peak named. */
export const commitsChart = (layout: ActivityLayout): Required<Plot> => {
  const { commits, buckets, plot } = layout;
  const hover = hoverZones(layout.zones, plot.height, (index) => ({
    title: buckets[index]?.label ?? "",
    rows: [
      {
        label: "commits",
        value: formatCount(buckets[index]?.commits ?? 0),
        key: "c-commits",
      },
      {
        label: "lines changed",
        value: `+${formatCount(buckets[index]?.added ?? 0)} −${formatCount(buckets[index]?.deleted ?? 0)}`,
      },
    ],
  }));
  return {
    stops: hover.stops,
    marks: [
      ...valueAxis(commits.ticks, plot.width),
      ...barMarks(commits.bars, "c-commits", commits.recentFrom ?? 0),
      baseline(layout, plot.height),
      s("line", {
        class: "average",
        x1: 0,
        x2: plot.width,
        y1: commits.average.y,
        y2: commits.average.y,
      }),
      ...peakLabel(layout),
      ...timeAxis(layout.timeTicks, plot.height),
      ...hover.marks,
    ],
  };
};

/** Lines added above the zero line and deleted below it, on one scale. */
export const churnChart = (layout: ActivityLayout): Required<Plot> => {
  const hover = hoverZones(layout.zones, layout.plot.height, (index) => ({
    title: layout.buckets[index]?.label ?? "",
    rows: [
      {
        label: "lines added",
        value: formatCount(layout.buckets[index]?.added ?? 0),
        key: "c-added",
      },
      {
        label: "lines deleted",
        value: formatCount(layout.buckets[index]?.deleted ?? 0),
        key: "c-deleted",
      },
    ],
  }));
  return {
    stops: hover.stops,
    marks: [
      ...valueAxis(layout.churn.ticks, layout.plot.width),
      ...barMarks(layout.churn.added, "c-added"),
      ...barMarks(layout.churn.deleted, "c-deleted"),
      baseline(layout, layout.churn.zero),
      ...timeAxis(layout.timeTicks, layout.plot.height),
      ...hover.marks,
    ],
  };
};

/** People with at least one commit, per month. */
export const contributorsChart = (layout: ActivityLayout): Required<Plot> => {
  const { bars, ticks, zones, timeTicks } = layout.contributors;
  const hover = hoverZones(zones, layout.plot.height, (index) => ({
    title: bars[index]?.month ?? "",
    rows: [
      {
        label: "active contributors",
        value: formatCount(bars[index]?.contributors ?? 0),
        key: "c-people",
      },
    ],
  }));
  return {
    stops: hover.stops,
    marks: [
      ...valueAxis(ticks, layout.plot.width),
      ...barMarks(
        bars.map(({ bar }) => bar),
        "c-people",
      ),
      baseline(layout, layout.plot.height),
      ...timeAxis(timeTicks, layout.plot.height),
      ...hover.marks,
    ],
  };
};

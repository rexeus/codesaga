import type { Report } from "@codesaga/engine";

import { layoutActivity } from "../layout/activity.js";
import type { ActivityLayout } from "../layout/activity.js";
import { barPath } from "../layout/bars.js";
import type { Bar } from "../layout/bars.js";
import type { Resolution } from "../layout/time-buckets.js";
import { formatCount } from "../present/format.js";
import {
  chartFigure,
  chartSvg,
  responsiveChart,
  timeAxis,
  valueAxis,
} from "./chart-frame.js";
import { h, s } from "./dom.js";
import { hoverZones } from "./hover.js";
import { legend, legendItem, section, tableView } from "./section.js";
import { dataTable } from "./table.js";

const CHART_HEIGHT = 170;

const barMarks = (bars: readonly Bar[], entity: string): SVGElement[] =>
  bars
    .filter(({ height }) => height > 0)
    .map((bar) => s("path", { class: `mark ${entity}`, d: barPath(bar) }));

const baseline = (layout: ActivityLayout, y: number): SVGElement =>
  s("line", { class: "baseline", x1: 0, x2: layout.plot.width, y1: y, y2: y });

const unit = (resolution: Resolution): string =>
  resolution === "weeks" ? "week" : "month";

const commitsChart = (layout: ActivityLayout): SVGElement[] => [
  ...valueAxis(layout.commits.ticks, layout.plot.width),
  ...barMarks(layout.commits.bars, "c-commits"),
  baseline(layout, layout.plot.height),
  ...timeAxis(layout.timeTicks, layout.plot.height),
  ...hoverZones(layout.zones, layout.plot.height, (index) => ({
    title: layout.buckets[index]?.label ?? "",
    rows: [
      {
        label: "commits",
        value: formatCount(layout.buckets[index]?.commits ?? 0),
        key: "c-commits",
      },
    ],
  })),
];

const churnChart = (layout: ActivityLayout): SVGElement[] => [
  ...valueAxis(layout.churn.ticks, layout.plot.width),
  ...barMarks(layout.churn.added, "c-added"),
  ...barMarks(layout.churn.deleted, "c-deleted"),
  baseline(layout, layout.churn.zero),
  ...timeAxis(layout.timeTicks, layout.plot.height),
  ...hoverZones(layout.zones, layout.plot.height, (index) => ({
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
  })),
];

const contributorsChart = (layout: ActivityLayout): SVGElement[] => {
  const { points, ticks, area, line, zones } = layout.contributors;
  const last = points.at(-1);
  return [
    ...valueAxis(ticks, layout.plot.width),
    s("path", { class: "wash c-people", d: area }),
    s("path", { class: "line c-people", d: line }),
    ...(last === undefined
      ? []
      : [s("circle", { class: "dot c-people", cx: last.x, cy: last.y, r: 5 })]),
    baseline(layout, layout.plot.height),
    ...timeAxis(layout.timeTicks, layout.plot.height),
    ...hoverZones(zones, layout.plot.height, (index) => ({
      title: points[index]?.month ?? "",
      rows: [
        {
          label: "active contributors",
          value: formatCount(points[index]?.contributors ?? 0),
          key: "c-people",
        },
      ],
    })),
  ];
};

type ChartSpec = {
  readonly title: (resolution: Resolution) => string;
  readonly description: string;
  readonly marks: (layout: ActivityLayout) => SVGElement[];
  readonly extras?: readonly Node[];
};

const chart = (activity: Report["activity"], spec: ChartSpec): HTMLElement => {
  const { figure, host, caption } = chartFigure(
    spec.title("weeks"),
    ...(spec.extras ?? []),
  );
  responsiveChart(host, (width) => {
    const size = { width, height: CHART_HEIGHT };
    const layout = layoutActivity(activity, size);
    if (layout === null) {
      return chartSvg(size, spec.description);
    }
    caption.textContent = spec.title(layout.resolution);
    return chartSvg(size, spec.description, ...spec.marks(layout));
  });
  return figure;
};

const activityTables = ({
  weeks,
  months,
}: Report["activity"]): HTMLElement[] => [
  dataTable(
    "Commits and lines per week",
    [
      { label: "Week of", cell: (week) => week.start },
      {
        label: "Commits",
        numeric: true,
        cell: (week) => formatCount(week.commits),
      },
      {
        label: "Lines added",
        numeric: true,
        cell: (week) => formatCount(week.added),
      },
      {
        label: "Lines deleted",
        numeric: true,
        cell: (week) => formatCount(week.deleted),
      },
    ],
    weeks,
  ),
  dataTable(
    "Commits and active contributors per month",
    [
      { label: "Month", cell: (month) => month.month },
      {
        label: "Commits",
        numeric: true,
        cell: (month) => formatCount(month.commits),
      },
      {
        label: "Active contributors",
        numeric: true,
        cell: (month) => formatCount(month.contributors),
      },
    ],
    months,
  ),
];

/** Commits and lines per week, and active contributors per month, on one time axis. */
export const renderActivity = ({ activity }: Report): HTMLElement => {
  const description = "Commits, lines changed and people over time";
  if (activity.weeks.length === 0 && activity.months.length === 0) {
    return section(
      "activity",
      "Activity",
      description,
      h("p", "empty", "No commits in the window."),
    );
  }
  return section(
    "activity",
    "Activity",
    description,
    chart(activity, {
      title: (resolution) => `Commits per ${unit(resolution)}`,
      description: "Bar chart of commits over time",
      marks: commitsChart,
    }),
    chart(activity, {
      title: (resolution) => `Lines added and deleted per ${unit(resolution)}`,
      description:
        "Mirrored bar chart of lines added above and deleted below the axis",
      marks: churnChart,
      extras: [
        legend(
          legendItem("c-added", "Added"),
          legendItem("c-deleted", "Deleted"),
        ),
      ],
    }),
    chart(activity, {
      title: () => "Active contributors per month",
      description: "Line chart of contributors with a commit in each month",
      marks: contributorsChart,
    }),
    tableView(() => activityTables(activity)),
  );
};

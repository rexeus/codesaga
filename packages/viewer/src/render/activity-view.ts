import type { Report } from "@codesaga/engine";

import { layoutActivity } from "../layout/activity.js";
import type { ActivityLayout } from "../layout/activity.js";
import {
  churnTitle,
  commitsSubtitle,
  commitsTitle,
} from "../present/captions.js";
import { emptyWindowNotice } from "../present/empty-window.js";
import { formatCount } from "../present/format.js";
import {
  churnChart,
  commitsChart,
  contributorsChart,
} from "./activity-charts.js";
import { chartFigure, chartSvg, responsiveChart } from "./chart-frame.js";
import type { Plot } from "./chart-frame.js";
import { h } from "./dom.js";
import { punchcardCard, punchcardTable } from "./punchcard-view.js";
import { legend, legendItem, section, tableView } from "./section.js";
import { dataTable } from "./table.js";

const CHART_HEIGHT = 230;

type ChartSpec = {
  readonly span: string;
  readonly title: (layout: ActivityLayout | null) => string;
  readonly subtitle: (layout: ActivityLayout | null) => string;
  readonly description: string;
  readonly marks: (layout: ActivityLayout) => Plot;
  readonly extras?: readonly Node[];
};

const chart = (activity: Report["activity"], spec: ChartSpec): HTMLElement => {
  const { figure, host, caption, note } = chartFigure(
    spec.title(null),
    spec.subtitle(null),
    ...(spec.extras ?? []),
  );
  figure.classList.add(spec.span);
  responsiveChart(host, (width) => {
    const size = { width, height: CHART_HEIGHT };
    const layout = layoutActivity(activity, size);
    if (layout === null) {
      return chartSvg(size, spec.description);
    }
    caption.textContent = spec.title(layout);
    note.textContent = spec.subtitle(layout);
    return chartSvg(size, spec.description, spec.marks(layout));
  });
  return figure;
};

const resolutionOf = (layout: ActivityLayout | null): "weeks" | "months" =>
  layout?.resolution ?? "weeks";

const commitsSpec = (span: string): ChartSpec => ({
  span,
  title: (layout) => commitsTitle(resolutionOf(layout)),
  subtitle: (layout) =>
    layout === null
      ? ""
      : commitsSubtitle(
          layout.resolution,
          layout.buckets.length,
          layout.commits.average.value,
          layout.commits.recentFrom !== null,
        ),
  description: "Bar chart of commits over time",
  marks: commitsChart,
});

const contributorsSpec: ChartSpec = {
  span: "c4",
  title: () => "Contributors per month",
  subtitle: () => "People with at least one commit",
  description: "Bar chart of contributors with a commit in each month",
  marks: contributorsChart,
};

const churnSpec: ChartSpec = {
  span: "c7",
  title: (layout) => churnTitle(resolutionOf(layout)),
  subtitle: () => "Added above the line, deleted below",
  description:
    "Mirrored bar chart of lines added above and deleted below the axis",
  marks: churnChart,
  extras: [
    legend(legendItem("c-added", "Added"), legendItem("c-deleted", "Deleted")),
  ],
};

const activityTables = (report: Report): HTMLElement[] => [
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
    report.activity.weeks,
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
    report.activity.months,
  ),
  punchcardTable(report.punchcard),
];

const DESCRIPTION =
  "Commit rhythm, size of changes and the hours people actually work.";

/** Commits and lines per week, active contributors per month and the weekday-and-hour heatmap. */
export const renderActivity = (report: Report): HTMLElement => {
  const notice = emptyWindowNotice(report);
  if (notice !== null) {
    return section(
      "activity",
      "Activity",
      "How the work moved",
      DESCRIPTION,
      h("p", "empty", notice),
    );
  }
  const solo = report.overview.contributors.allTime === 1;
  return section(
    "activity",
    "Activity",
    "How the work moved",
    DESCRIPTION,
    h(
      "div",
      "grid12",
      chart(report.activity, commitsSpec(solo ? "c12" : "c8")),
      ...(solo ? [] : [chart(report.activity, contributorsSpec)]),
      chart(report.activity, churnSpec),
      punchcardCard(report),
    ),
    tableView(() => activityTables(report)),
  );
};

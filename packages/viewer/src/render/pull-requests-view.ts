import type { Report } from "@codesaga/engine";

import { barPath } from "../layout/bars.js";
import { layoutPullRequests } from "../layout/pull-requests.js";
import type { PullRequestsLayout } from "../layout/pull-requests.js";
import { emptyWindowNotice } from "../present/empty-window.js";
import { formatCount } from "../present/format.js";
import {
  listLimitNotes,
  pullRequestFigures,
  pullRequestNotes,
} from "../present/pull-requests.js";
import {
  chartFigure,
  chartSvg,
  responsiveChart,
  timeAxis,
  valueAxis,
} from "./chart-frame.js";
import type { Plot } from "./chart-frame.js";
import { h, s } from "./dom.js";
import { hoverZones } from "./hover.js";
import { legend, legendItem, panel, section, tableView } from "./section.js";
import { dataTable } from "./table.js";

const CHART_HEIGHT = 190;

type PullRequests = NonNullable<Report["pullRequests"]>;

const pairsPlot = (layout: PullRequestsLayout): Required<Plot> => {
  const hover = hoverZones(layout.zones, layout.plot.height, (index) => {
    const pair = layout.pairs[index];
    return {
      title: pair?.month ?? "",
      rows: [
        {
          label: "opened",
          value: formatCount(pair?.opened ?? 0),
          key: "c-opened",
        },
        {
          label: "merged",
          value: formatCount(pair?.merged ?? 0),
          key: "c-merged",
        },
      ],
    };
  });
  const bars = layout.pairs.flatMap(({ openedBar, mergedBar }) => [
    { bar: openedBar, entity: "c-opened" },
    { bar: mergedBar, entity: "c-merged" },
  ]);
  return {
    stops: hover.stops,
    marks: [
      ...valueAxis(layout.ticks, layout.plot.width),
      ...bars
        .filter(({ bar }) => bar.height > 0)
        .map(({ bar, entity }) =>
          s("path", { class: `mark ${entity}`, d: barPath(bar) }),
        ),
      s("line", {
        class: "baseline",
        x1: 0,
        x2: layout.plot.width,
        y1: layout.plot.height,
        y2: layout.plot.height,
      }),
      ...timeAxis(layout.timeTicks, layout.plot.height),
      ...hover.marks,
    ],
  };
};

const monthlyChart = (months: PullRequests["months"]): HTMLElement => {
  const { figure, host } = chartFigure(
    "Pull requests opened and merged per month",
    "Opened and merged, by month",
    legend(legendItem("c-opened", "Opened"), legendItem("c-merged", "Merged")),
  );
  const description =
    "Bar chart of pull requests opened and merged in each month";
  responsiveChart(host, (width) => {
    const size = { width, height: CHART_HEIGHT };
    const layout = layoutPullRequests(months, size);
    return chartSvg(
      size,
      description,
      layout === null ? undefined : pairsPlot(layout),
    );
  });
  return figure;
};

const figures = (pullRequests: PullRequests): HTMLElement =>
  h(
    "ul",
    "tiles",
    ...pullRequestFigures(pullRequests).map(({ label, value, detail }) =>
      h(
        "li",
        "tile",
        h("span", "tile-label", label),
        h("strong", "tile-value", value),
        h("span", "tile-detail", detail),
      ),
    ),
  );

const authorsTable = ({ authors }: PullRequests): HTMLElement =>
  dataTable(
    "Pull requests opened and merged by author",
    [
      { label: "Author", cell: ({ login }) => login },
      {
        label: "Opened",
        numeric: true,
        cell: ({ opened }) => formatCount(opened),
      },
      {
        label: "Merged",
        numeric: true,
        cell: ({ merged }) => formatCount(merged),
      },
    ],
    authors,
  );

const reviewersTable = ({ reviewers }: PullRequests): HTMLElement =>
  dataTable(
    "Reviews given in the window",
    [
      { label: "Reviewer", cell: ({ login }) => login },
      {
        label: "Reviews",
        numeric: true,
        cell: ({ reviews }) => formatCount(reviews),
      },
      {
        label: "Approvals",
        numeric: true,
        cell: ({ approvals }) => formatCount(approvals),
      },
    ],
    reviewers,
  );

const monthTable = ({ months }: PullRequests): HTMLElement =>
  dataTable(
    "Pull requests opened and merged per month",
    [
      { label: "Month", cell: ({ month }) => month },
      {
        label: "Opened",
        numeric: true,
        cell: ({ opened }) => formatCount(opened),
      },
      {
        label: "Merged",
        numeric: true,
        cell: ({ merged }) => formatCount(merged),
      },
    ],
    months,
  );

/**
 * Pull requests opened and merged per month, the median times to merge and to
 * first review, who opened them and the reviews given, from GitHub. Nothing for a report made
 * without `--github`.
 */
export const renderPullRequests = (report: Report): HTMLElement | null => {
  const { pullRequests } = report;
  if (pullRequests === undefined) {
    return null;
  }
  const description =
    "Opened and merged, how long they took, and who reviewed. Counts give context, not a ranking.";
  const notice = emptyWindowNotice(report);
  const content =
    notice === null
      ? [
          figures(pullRequests),
          monthlyChart(pullRequests.months),
          panel(
            pullRequests.authors.length === 0
              ? h("p", "empty", "No pull requests by people in the window.")
              : authorsTable(pullRequests),
            pullRequests.reviewers.length === 0
              ? h("p", "empty", "No reviews by others in the window.")
              : reviewersTable(pullRequests),
            ...[
              ...listLimitNotes(pullRequests),
              ...pullRequestNotes(pullRequests),
            ].map((note) => h("p", "note", note)),
            tableView(() => [monthTable(pullRequests)]),
          ),
        ]
      : [h("p", "empty", notice)];
  return section(
    "pull-requests",
    "Pull requests",
    "How the review flow moved",
    description,
    h("div", "stack", ...content),
  );
};

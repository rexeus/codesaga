import type { Report } from "@codesaga/engine";

import { layoutAutomation } from "../layout/automation.js";
import type { AutomationLayout } from "../layout/automation.js";
import { barPath } from "../layout/bars.js";
import { AUTOMATION_CLASSES, classShares } from "../present/automation.js";
import { formatCount, formatPercent } from "../present/format.js";
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

const CHART_HEIGHT = 190;

type Automation = Report["automation"];

const entityOf = (key: string): string =>
  AUTOMATION_CLASSES.find((entry) => entry.key === key)?.entity ?? "";

const stackMarks = (layout: AutomationLayout): SVGElement[] => [
  ...valueAxis(layout.ticks, layout.plot.width),
  ...layout.stacks.flatMap(({ segments }) =>
    segments
      .filter(({ height }) => height > 0)
      .map((segment) =>
        s("path", {
          class: `mark ${entityOf(segment.key)}`,
          d: barPath(segment),
        }),
      ),
  ),
  s("line", {
    class: "baseline",
    x1: 0,
    x2: layout.plot.width,
    y1: layout.plot.height,
    y2: layout.plot.height,
  }),
  ...timeAxis(layout.timeTicks, layout.plot.height),
  ...hoverZones(layout.zones, layout.plot.height, (index) => {
    const stack = layout.stacks[index];
    return {
      title: stack?.month ?? "",
      rows: [
        ...(stack?.segments ?? []).toReversed().map((segment) => ({
          label:
            AUTOMATION_CLASSES.find(({ key }) => key === segment.key)?.label ??
            "",
          value: formatCount(segment.commits),
          key: entityOf(segment.key),
        })),
        { label: "commits in total", value: formatCount(stack?.total ?? 0) },
      ],
    };
  }),
];

const stackedChart = (months: Automation["months"]): HTMLElement => {
  const { figure, host } = chartFigure("Commits per month by author class");
  const description =
    "Stacked bar chart of commits per month by human, agent-assisted, agent and bot";
  responsiveChart(host, (width) => {
    const size = { width, height: CHART_HEIGHT };
    const layout = layoutAutomation(months, size);
    return chartSvg(
      size,
      description,
      ...(layout === null ? [] : stackMarks(layout)),
    );
  });
  return figure;
};

const toolsTable = (tools: Automation["tools"]): HTMLElement =>
  dataTable(
    "Detected agents and bots",
    [
      { label: "Tool", cell: ({ name }) => name },
      {
        label: "Kind",
        cell: ({ kind }) =>
          h(
            "span",
            "badge",
            h("span", `swatch ${kind === "agent" ? "c-agent" : "c-bot"}`),
            kind === "agent" ? "Agent" : "Bot",
          ),
      },
      {
        label: "Authored",
        numeric: true,
        cell: ({ authored }) => formatCount(authored),
      },
      {
        label: "Assisted",
        numeric: true,
        cell: ({ assisted }) => formatCount(assisted),
      },
    ],
    tools,
  );

const monthTable = (months: Automation["months"]): HTMLElement =>
  dataTable(
    "Commits per month by author class",
    [
      { label: "Month", cell: ({ month }) => month },
      ...AUTOMATION_CLASSES.map(({ key, label }) => ({
        label,
        numeric: true,
        cell: (month: Automation["months"][number]) => formatCount(month[key]),
      })),
    ],
    months,
  );

/** Commits per month by human, agent-assisted, agent and bot, and the detected tools. */
export const renderAutomation = ({ automation }: Report): HTMLElement => {
  const description =
    "Who authored the commits: people, people with an agent, agents and bots";
  const classes = legend(
    ...classShares(automation.totals).map(({ entity, label, commits, share }) =>
      legendItem(
        entity,
        label,
        `${formatCount(commits)} (${formatPercent(share)})`,
      ),
    ),
  );
  return section(
    "automation",
    "Automation",
    description,
    classes,
    stackedChart(automation.months),
    h(
      "p",
      "note",
      "A missing trailer means not detected, not human-written: agent-assisted and agent commits are a lower bound.",
    ),
    automation.tools.length === 0
      ? h("p", "empty", "No agents or bots detected.")
      : toolsTable(automation.tools),
    tableView(() => [monthTable(automation.months)]),
  );
};

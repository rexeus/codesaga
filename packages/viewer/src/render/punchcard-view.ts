import type { Report } from "@codesaga/engine";

import { hourSpan, layoutPunchcard } from "../layout/punchcard.js";
import type { PunchcardLayout } from "../layout/punchcard.js";
import { formatCount } from "../present/format.js";
import {
  chartFigure,
  chartSvg,
  responsiveChart,
  timeAxis,
} from "./chart-frame.js";
import { h, s } from "./dom.js";
import { section, tableView } from "./section.js";
import { dataTable } from "./table.js";
import { bindTooltip } from "./tooltip.js";

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const dotMarks = (layout: PunchcardLayout): SVGElement[] => [
  ...layout.weekdayTicks.flatMap(({ position, label }) => {
    const text = s("text", {
      class: "tick-label",
      x: -8,
      y: position,
      "text-anchor": "end",
      dy: "0.32em",
    });
    text.textContent = label;
    return [
      s("line", {
        class: "grid",
        x1: 0,
        x2: layout.plot.width,
        y1: position,
        y2: position,
      }),
      text,
    ];
  }),
  ...layout.dots.map(({ cx, cy, radius }) =>
    s("circle", { class: "mark c-commits", cx, cy, r: radius }),
  ),
  ...timeAxis(layout.hourTicks, layout.plot.height),
  ...layout.cells.map((cell) => {
    const area = s("rect", {
      class: "zone",
      x: cell.x,
      y: cell.y,
      width: layout.cell.width,
      height: layout.cell.height,
    });
    bindTooltip(area, {
      title: `${cell.weekday} ${hourSpan(cell.hour)}`,
      rows: [
        {
          label: "commits",
          value: formatCount(cell.commits),
          key: "c-commits",
        },
      ],
    });
    return area;
  }),
];

const caption = (layout: PunchcardLayout): string => {
  const { busiest } = layout;
  return busiest === null
    ? "No commits in the window."
    : `Dot area is proportional to commits; the largest dot is ${formatCount(busiest.commits)} commits (${busiest.weekday} ${hourSpan(busiest.hour)}).`;
};

const hourTable = (punchcard: Report["punchcard"]): HTMLElement =>
  dataTable(
    "Commits per weekday and hour",
    [
      { label: "Day", cell: ([name]) => name },
      ...Array.from({ length: 24 }, (_, hour) => ({
        label: String(hour).padStart(2, "0"),
        numeric: true,
        cell: ([, counts]: readonly [string, readonly number[]]) =>
          formatCount(counts[hour] ?? 0),
      })),
    ],
    WEEKDAY_NAMES.map((name, row): [string, readonly number[]] => [
      name,
      punchcard[row] ?? [],
    ]),
  );

/** Commits per weekday and hour as a dot grid in the author's local time. */
export const renderPunchcard = ({ punchcard }: Report): HTMLElement => {
  const { figure, host } = chartFigure("Commits per weekday and hour");
  const note = h("p", "note");
  responsiveChart(host, (width) => {
    const layout = layoutPunchcard(punchcard, width);
    note.textContent = caption(layout);
    return chartSvg(
      layout.size,
      "Dot grid of commits by weekday and hour of the day",
      ...dotMarks(layout),
    );
  });
  return section(
    "punchcard",
    "Punch card",
    "When people commit, in the author's local time. Human and agent-assisted commits only.",
    figure,
    note,
    tableView(() => [hourTable(punchcard)]),
  );
};

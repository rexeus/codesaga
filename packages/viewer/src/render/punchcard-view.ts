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
import type { Plot } from "./chart-frame.js";
import { h, s } from "./dom.js";
import { section, tableView } from "./section.js";
import { dataTable } from "./table.js";
import { bindTooltip } from "./tooltip.js";
import type { TooltipContent } from "./tooltip.js";

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const gridMarks = (layout: PunchcardLayout): SVGElement[] => [
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
];

/** The dot grid with one hover area per cell, visited row by row, starting at the busiest cell. */
const dotPlot = (layout: PunchcardLayout): Required<Plot> => {
  const contents = layout.cells.map((cell): TooltipContent => ({
    title: `${cell.weekday} ${hourSpan(cell.hour)}`,
    rows: [
      {
        label: "commits",
        value: formatCount(cell.commits),
        key: "c-commits",
      },
    ],
  }));
  const areas = layout.cells.map((cell, index) => {
    const area = s("rect", {
      class: "zone",
      x: cell.x,
      y: cell.y,
      width: layout.cell.width,
      height: layout.cell.height,
    });
    bindTooltip(area, contents[index] ?? { title: "", rows: [] });
    return area;
  });
  return {
    marks: [...gridMarks(layout), ...areas],
    stops: {
      grid: { rows: layout.weekdayTicks.length, columns: 24 },
      start: Math.max(
        0,
        layout.busiest === null ? 0 : layout.cells.indexOf(layout.busiest),
      ),
      areas,
      content: (index) => contents[index] ?? { title: "", rows: [] },
    },
  };
};

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
      dotPlot(layout),
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

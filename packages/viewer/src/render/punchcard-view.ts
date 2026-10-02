import type { Report } from "@codesaga/engine";

import { HEAT_LEVELS, hourSpan, layoutPunchcard } from "../layout/punchcard.js";
import type { PunchcardLayout } from "../layout/punchcard.js";
import { formatCount, formatPercent } from "../present/format.js";
import { nightLabel, rhythmOf } from "../present/rhythm.js";
import { chartFigure, chartSvg, responsiveChart } from "./chart-frame.js";
import type { Plot } from "./chart-frame.js";
import { h, s } from "./dom.js";
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

const CELL_GAP = 2;
const MAX_CELL_RADIUS = 5;

const weekdayLabels = (layout: PunchcardLayout): SVGElement[] =>
  layout.weekdayTicks.map(({ position, label }) => {
    const text = s("text", {
      class: "tick-label",
      x: -8,
      y: position,
      "text-anchor": "end",
      dy: "0.32em",
    });
    text.textContent = label;
    return text;
  });

/** The hours start at the left edge of their cell, so the label reads along the row like the cell does. */
const hourLabels = (layout: PunchcardLayout): SVGElement[] =>
  layout.hourTicks.map(({ position, label }) => {
    const text = s("text", {
      class: "tick-label",
      x: position + CELL_GAP / 2,
      y: layout.plot.height + 16,
    });
    text.textContent = label;
    return text;
  });

const cellMarks = (layout: PunchcardLayout): SVGElement[] =>
  layout.cells.map(({ x, y, level }) =>
    s("rect", {
      class: level === 0 ? "cell" : `cell h${level}`,
      x: x + CELL_GAP / 2,
      y: y + CELL_GAP / 2,
      width: layout.cell.width - CELL_GAP,
      height: layout.cell.height - CELL_GAP,
      rx: Math.min(MAX_CELL_RADIUS, layout.cell.height / 4),
    }),
  );

/** The heatmap with one hover area per cell, visited row by row, starting at the busiest cell. */
const heatmap = (layout: PunchcardLayout): Required<Plot> => {
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
    marks: [
      ...weekdayLabels(layout),
      ...cellMarks(layout),
      ...hourLabels(layout),
      ...areas,
    ],
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

const scale = (): HTMLElement =>
  h(
    "div",
    "scale",
    "less",
    ...Array.from({ length: HEAT_LEVELS }, (_, level) =>
      h("i", `l${level + 1}`),
    ),
    "more",
  );

const stat = (value: string, label: string): HTMLElement =>
  h("div", "", h("strong", "", value), h("span", "", label));

const rhythmStats = ({ punchcard, thresholds }: Report): HTMLElement[] => {
  const night = thresholds.stories;
  const rhythm = rhythmOf(punchcard, night);
  if (rhythm === null) {
    return [];
  }
  return [
    h(
      "div",
      "rhythm",
      stat(formatPercent(rhythm.weekendShare), "on weekends"),
      stat(formatPercent(rhythm.nightShare), nightLabel(night)),
      stat(`${String(rhythm.busiestHour).padStart(2, "0")}:00`, "busiest hour"),
    ),
  ];
};

/** The weekday-and-hour card: the heatmap in the author's local time and the weekend, night and busiest-hour figures. */
export const punchcardCard = (report: Report): HTMLElement => {
  const { figure, host } = chartFigure(
    "When the work happens",
    "Weekday and hour, author local time",
    scale(),
  );
  figure.classList.add("c5");
  responsiveChart(host, (width) => {
    const layout = layoutPunchcard(report.punchcard, width);
    return chartSvg(
      layout.size,
      "Heatmap of commits by weekday and hour of the day",
      heatmap(layout),
    );
  });
  figure.append(...rhythmStats(report));
  return figure;
};

/** The punchcard as a table: a row per weekday, a column per hour. */
export const punchcardTable = (punchcard: Report["punchcard"]): HTMLElement =>
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

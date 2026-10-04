import { chartSizeFor } from "../layout/plot.js";
import type { Size } from "../layout/plot.js";
import { layoutTrend } from "../layout/trend.js";
import type { TypeScriptDeepDive } from "../present/typescript-summary.js";
import {
  trendChoices,
  trendLine,
  startNote,
} from "../present/typescript-trends.js";
import type { TrendId, TrendLine } from "../present/typescript-trends.js";
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
import { tableView } from "./section.js";
import { dataTable } from "./table.js";

type Trends = NonNullable<TypeScriptDeepDive["trends"]>;

const PLOT_HEIGHT = 170;
const MINI_PLOT_HEIGHT = 90;

const marks = (line: TrendLine, size: Size): Plot | null => {
  const layout = layoutTrend(line.months, line.values, size, line.axis);
  if (layout === null) {
    return null;
  }
  const hover = hoverZones(layout.zones, layout.plot.height, (index) => {
    const month = line.details[index];
    return {
      title: month?.label ?? "",
      rows: [
        {
          label: line.unit,
          value: month?.figure ?? "–",
          key: "c-trend",
        },
      ],
      ...(month === undefined ? {} : { text: month.detail }),
    };
  });
  return {
    stops: hover.stops,
    marks: [
      ...valueAxis(layout.ticks, layout.plot.width),
      s("line", {
        class: "baseline",
        x1: 0,
        x2: layout.plot.width,
        y1: layout.zero,
        y2: layout.zero,
      }),
      s("path", { class: "mark trend", d: layout.path }),
      ...layout.dots.map(({ x, y }) =>
        s("circle", { class: "trend-dot", cx: x, cy: y, r: 3.5 }),
      ),
      ...timeAxis(layout.timeTicks, layout.plot.height),
      ...hover.marks,
    ],
  };
};

const drawer =
  (current: () => TrendLine, plotHeight: number) =>
  (width: number): SVGElement => {
    const line = current();
    const size = chartSizeFor(width, plotHeight);
    const plot = marks(line, size);
    return chartSvg(
      size,
      plot === null
        ? `${line.title}: not enough months to draw a line`
        : `Line chart: ${line.title}`,
      plot ?? undefined,
    );
  };

const monthTable = (line: TrendLine): HTMLElement =>
  dataTable(
    line.title,
    [
      { label: "Month", cell: (month) => month.label },
      { label: "Value", numeric: true, cell: (month) => month.figure },
      { label: "Counts", cell: (month) => month.detail },
    ],
    line.details.toReversed(),
  );

const picker = (
  choices: ReturnType<typeof trendChoices>,
  onPick: (id: TrendId) => void,
): HTMLElement => {
  const group = h("div", "filters trend-picker");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Series");
  const buttons = choices.map(({ id, label }) => {
    const button = h("button", "", label);
    button.type = "button";
    button.addEventListener("click", () => {
      onPick(id);
      for (const other of buttons) {
        other.button.setAttribute("aria-pressed", String(other.id === id));
      }
    });
    return { id, button };
  });
  for (const { id, button } of buttons) {
    button.setAttribute("aria-pressed", String(id === buttons[0]?.id));
  }
  group.append(...buttons.map(({ button }) => button));
  return group;
};

/**
 * The code over time as one line chart with a picker: escape hatches and
 * `any` per 1,000 lines, the share of complex functions, the share of ES
 * modules and the test cases. The months are those of the first-parent chain
 * the report replays, and the note says when that starts after the repository.
 * The chart redraws to the card's width and is reachable with the keyboard.
 */
export const trendCard = (
  trends: Trends,
  typed: boolean,
  firstCommitAt: string | null,
): HTMLElement | null => {
  const choices = trendChoices(trends, typed);
  const [first] = choices;
  if (first === undefined || trends.months.length < 2) {
    return null;
  }
  let line = trendLine(trends, first.id);
  const { figure, host, caption, note } = chartFigure(
    line.title,
    line.subtitle,
    picker(choices, (id) => {
      line = trendLine(trends, id);
      caption.textContent = line.title;
      note.textContent = line.subtitle;
      redraw();
      table.replaceChildren(monthTable(line));
    }),
  );
  figure.classList.add("trend");
  const redraw = responsiveChart(
    host,
    drawer(() => line, PLOT_HEIGHT),
  );
  const table = h("div", "trend-table", monthTable(line));
  const start = startNote(trends, firstCommitAt);
  figure.append(
    ...(start === null ? [] : [h("p", "note", start)]),
    tableView(() => [table]),
  );
  return figure;
};

/**
 * One fixed line of the trends as a small chart without a card, for a card
 * that tells one story, such as the module era; null without two months.
 */
export const trendChart = (trends: Trends, id: TrendId): HTMLElement | null => {
  const line = trendLine(trends, id);
  if (trends.months.length < 2) {
    return null;
  }
  const host = h("div", "chart-host trend-mini");
  responsiveChart(
    host,
    drawer(() => line, MINI_PLOT_HEIGHT),
  );
  return h("figure", "trend-fig", h("figcaption", "slabel", line.title), host);
};

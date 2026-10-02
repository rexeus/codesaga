import { barPath } from "../layout/bars.js";
import { layoutHistogram } from "../layout/histogram.js";
import type { HistogramLayout } from "../layout/histogram.js";
import { chartSizeFor } from "../layout/plot.js";
import { formatCount } from "../present/format.js";
import type { HistogramView } from "../present/histograms.js";
import {
  chartFigure,
  chartSvg,
  responsiveChart,
  timeAxis,
  valueAxis,
} from "./chart-frame.js";
import type { Plot } from "./chart-frame.js";
import { h, mono, s } from "./dom.js";
import { hoverZones } from "./hover.js";
import { legend, legendItem, tableView } from "./section.js";
import { dataTable } from "./table.js";

const PLOT_HEIGHT = 150;

const barMarks = ({ bars }: HistogramLayout): SVGElement[] =>
  bars.flatMap(({ bar, median }) =>
    bar.height > 0
      ? [
          s("path", {
            class: `mark bin${median ? " median" : ""}`,
            d: barPath(bar),
          }),
        ]
      : [],
  );

const counts = ({ bars }: HistogramLayout): SVGElement[] =>
  bars.flatMap(({ bar, files, annotated, x }) => {
    if (!annotated) {
      return [];
    }
    const text = s("text", {
      class: "annotation",
      x,
      y: bar.y - 6,
      "text-anchor": "middle",
    });
    text.textContent = formatCount(files);
    return [text];
  });

const marks = (
  view: HistogramView,
  layout: HistogramLayout,
): Required<Plot> => {
  const { plot } = layout;
  const hover = hoverZones(layout.zones, plot.height, (index) => {
    const entry = layout.bars[index];
    return {
      title: `${entry?.label ?? ""} ${view.unit}`,
      rows: [{ label: view.noun, value: formatCount(entry?.files ?? 0) }],
      ...(entry?.median === true ? { text: "Holds the median file." } : {}),
    };
  });
  return {
    stops: hover.stops,
    marks: [
      ...valueAxis(layout.ticks, plot.width),
      ...barMarks(layout),
      s("line", {
        class: "baseline",
        x1: 0,
        x2: plot.width,
        y1: plot.height,
        y2: plot.height,
      }),
      ...counts(layout),
      ...timeAxis(layout.labelTicks, plot.height),
      ...hover.marks,
    ],
  };
};

const facts = ({ facts: figures, named }: HistogramView): HTMLElement =>
  h(
    "div",
    "facts3",
    ...figures.map(({ value, label }) =>
      h("div", "", h("b", "", value), h("span", "", label)),
    ),
    ...(named === null
      ? []
      : [
          h(
            "div",
            "wide",
            mono(named.name, named.path),
            h("span", "", named.note),
          ),
        ]),
  );

/**
 * A histogram of files as a card: thin bars with the median bucket in the full
 * accent, the figures that sum it up, and a table view of the same buckets.
 * The chart redraws to the card's width and can be read with the keyboard.
 */
export const histogramCard = (view: HistogramView): HTMLElement => {
  const { figure, host } = chartFigure(
    view.title,
    view.subtitle,
    legend(legendItem("c-median", "median bucket")),
  );
  responsiveChart(host, (width) => {
    const size = chartSizeFor(width, PLOT_HEIGHT);
    const layout = layoutHistogram(view.bins, size, view.annotateAll);
    return chartSvg(size, `Bar chart: ${view.title}`, marks(view, layout));
  });
  figure.append(
    facts(view),
    tableView(() => [
      dataTable(
        view.title,
        [
          { label: view.rangeHeading, cell: (bin) => bin.label },
          {
            label: `${view.noun.slice(0, 1).toUpperCase()}${view.noun.slice(1)}`,
            numeric: true,
            cell: (bin) => formatCount(bin.files),
          },
        ],
        view.bins,
      ),
    ]),
  );
  return figure;
};

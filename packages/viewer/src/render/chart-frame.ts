import { PLOT_ORIGIN } from "../layout/plot.js";
import type { Size, Tick } from "../layout/plot.js";
import { h, s } from "./dom.js";

/** The horizontal gridlines and left-hand labels of a value axis. */
export const valueAxis = (
  ticks: readonly Tick[],
  width: number,
): SVGElement[] =>
  ticks.flatMap(({ position, label }) => {
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
        x2: width,
        y1: position,
        y2: position,
      }),
      text,
    ];
  });

/** The labels of a time axis under a plot of `height`. */
export const timeAxis = (
  ticks: readonly Tick[],
  height: number,
): SVGElement[] =>
  ticks.map(({ position, label }) => {
    const text = s("text", {
      class: "tick-label",
      x: position,
      y: height + 16,
      "text-anchor": "middle",
    });
    text.textContent = label;
    return text;
  });

/** An `<svg>` of `size` whose children are drawn in plot coordinates. */
export const chartSvg = (
  size: Size,
  description: string,
  ...plotChildren: readonly SVGElement[]
): SVGElement => {
  const svg = s(
    "svg",
    {
      width: size.width,
      height: size.height,
      viewBox: `0 0 ${size.width} ${size.height}`,
      role: "img",
      "aria-label": description,
    },
    s("g", { transform: `translate(${PLOT_ORIGIN.x} ${PLOT_ORIGIN.y})` }),
  );
  svg.firstElementChild?.append(...plotChildren);
  return svg;
};

/**
 * Draws a chart into `host` and redraws it whenever the host's width changes,
 * so the layout always matches the pixels it has.
 */
export const responsiveChart = (
  host: HTMLElement,
  draw: (width: number) => SVGElement,
): void => {
  let drawnWidth = 0;
  const render = (): void => {
    const width = Math.floor(host.clientWidth);
    if (width === drawnWidth || width === 0) {
      return;
    }
    drawnWidth = width;
    host.replaceChildren(draw(width));
  };
  new ResizeObserver(render).observe(host);
  render();
};

/** A titled chart container; the caller fills `.chart-host`. */
export const chartFigure = (
  title: string,
  ...headExtras: readonly Node[]
): { figure: HTMLElement; host: HTMLElement; caption: HTMLElement } => {
  const host = h("div", "chart-host");
  const caption = h("figcaption", "chart-title", title);
  const figure = h(
    "figure",
    "chart",
    h("div", "chart-head", caption, ...headExtras),
    host,
  );
  return { figure, host, caption };
};

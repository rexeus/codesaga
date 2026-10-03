import { h } from "./dom.js";
import { bindTooltip } from "./tooltip.js";

/** A chart-styled card: a title and a subtitle, then its content. */
export const card = (
  title: string,
  subtitle: string,
  ...content: readonly Node[]
): HTMLElement =>
  h(
    "section",
    "card chart",
    h(
      "div",
      "chart-head",
      h(
        "div",
        "",
        h("h3", "chart-title", title),
        h("p", "chart-sub", subtitle),
      ),
    ),
    ...content,
  );

/** One part of a stacked bar: it takes a share of the bar by `weight`, and its tooltip says `tip`. */
export const weightedSegment = (
  weight: number,
  entity: string,
  tip: string,
): HTMLElement => {
  const segment = h("i", entity);
  segment.style.flex = `${Math.max(weight, 0.0001)} 1 0`;
  bindTooltip(segment, { title: tip, rows: [] });
  return segment;
};

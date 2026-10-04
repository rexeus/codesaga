import type { Comparison } from "../present/code-stats.js";
import type { IconName } from "../present/icons.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";

/** The small uppercase label of a stat, with its icon. */
export const labelled = (glyph: IconName, label: string): HTMLElement =>
  h("div", "slabel", icon(glyph, 14, 2), label);

/** A stat of the panel: its label, then its body. */
export const item = (
  glyph: IconName,
  label: string,
  ...body: readonly Node[]
): HTMLElement => h("div", "sitem", labelled(glyph, label), ...body);

/** A line of text under a stat's label. */
export const caption = (...content: readonly (Node | string)[]): HTMLElement =>
  h("div", "cap", ...content);

/** A fraction between 0 and 1 as a CSS percentage. */
export const percentOf = (fraction: number): string => `${fraction * 100}%`;

/** A bar with the territory's figure as its fill and the repository's as a tick across it. */
export const comparisonBar = (
  { value, reference }: Comparison,
  description: string,
): HTMLElement => {
  const fill = h("i", "fill");
  fill.style.width = percentOf(value);
  const mark = h("i", "ref");
  mark.style.left = percentOf(reference);
  const bar = h("div", "cmp", fill, mark);
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", description);
  return bar;
};

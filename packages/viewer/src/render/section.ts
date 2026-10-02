import { SECTION_ICONS } from "../present/sections.js";
import type { SectionId } from "../present/sections.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";

/** A section of the page: an eyebrow, a title and a line, then its content. */
export const section = (
  id: SectionId,
  eyebrow: string,
  title: string,
  description: string,
  ...content: readonly Node[]
): HTMLElement => {
  const block = h(
    "section",
    "block",
    h(
      "div",
      "sec-head",
      h(
        "div",
        "",
        h("div", "eyebrow", icon(SECTION_ICONS[id], 15, 2), eyebrow),
        h("h2", "", title),
      ),
      h("p", "", description),
    ),
    ...content,
  );
  block.id = id;
  return block;
};

/** A card holding stacked content, such as a table with its notes. */
export const panel = (...content: readonly Node[]): HTMLElement =>
  h("div", "card panel", ...content);

/** One legend entry: an entity-colored swatch, its name and optional figure. */
export const legendItem = (
  entity: string,
  name: string,
  figure?: string,
): HTMLElement =>
  h(
    "li",
    "",
    h("span", `swatch ${entity}`),
    h("span", "", name),
    ...(figure === undefined ? [] : [h("strong", "", figure)]),
  );

export const legend = (...items: readonly HTMLElement[]): HTMLElement =>
  h("ul", "legend", ...items);

/**
 * A collapsed "Table view" that builds its tables when first opened: the
 * charts' values without a pointer, and no cost for readers who never open it.
 */
export const tableView = (build: () => readonly Node[]): HTMLElement => {
  const details = h("details", "table-view", h("summary", "", "Table view"));
  details.addEventListener(
    "toggle",
    () => {
      details.append(...build());
    },
    { once: true },
  );
  return details;
};

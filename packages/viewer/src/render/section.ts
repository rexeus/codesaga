import { h } from "./dom.js";

/** A dashboard card with a heading and a one-line description. */
export const section = (
  id: string,
  title: string,
  description: string,
  ...content: readonly Node[]
): HTMLElement => {
  const card = h(
    "section",
    "card",
    h("header", "", h("h2", "", title), h("p", "", description)),
    ...content,
  );
  card.id = id;
  return card;
};

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

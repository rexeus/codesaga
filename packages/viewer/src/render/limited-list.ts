import { showAllLabel, visibleRows } from "../present/row-limit.js";
import type { RowLimit } from "../present/row-limit.js";
import { h } from "./dom.js";

/**
 * Rows of a list that builds only the first `limit.rows` until the reader asks
 * for all of them. The button disappears when nothing is left to show.
 */
export const limitedList = <Row>(
  rows: readonly Row[],
  limit: RowLimit,
  className: string,
  build: (row: Row) => HTMLElement,
): HTMLElement => {
  const list = h("div", className);
  const more = h("button", "show-all", showAllLabel(rows.length, limit));
  more.type = "button";
  const draw = (showAll: boolean): void => {
    const shown = visibleRows(rows, limit, showAll);
    list.replaceChildren(...shown.map((row) => build(row)));
    more.hidden = shown.length === rows.length;
  };
  more.addEventListener("click", () => {
    draw(true);
    more.hidden = true;
  });
  draw(false);
  return h("div", "limited", list, more);
};

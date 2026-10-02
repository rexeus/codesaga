import { showAllLabel, visibleRows } from "../present/row-limit.js";
import type { RowLimit } from "../present/row-limit.js";
import { h } from "./dom.js";

/** A table column: a header and how to show a row's cell. */
export type Column<Row> = {
  readonly label: string;
  readonly numeric?: boolean;
  readonly cell: (row: Row) => Node | string;
};

const ROW_LIMIT: RowLimit = { rows: 100, noun: "rows" };

const bodyRows = <Row>(
  columns: readonly Column<Row>[],
  rows: readonly Row[],
): HTMLElement[] =>
  rows.map((row) =>
    h(
      "tr",
      "",
      ...columns.map((column) =>
        h("td", column.numeric === true ? "num" : "", column.cell(row)),
      ),
    ),
  );

/**
 * A table of `rows`. Only the first 100 rows are built until the reader asks
 * for all of them, so a report with thousands of rows stays fast.
 */
export const dataTable = <Row>(
  caption: string,
  columns: readonly Column<Row>[],
  rows: readonly Row[],
): HTMLElement => {
  let showAll = false;
  const body = h("tbody", "");
  const more = h("button", "show-all", showAllLabel(rows.length, ROW_LIMIT));
  more.type = "button";

  const render = (): void => {
    const shown = visibleRows(rows, ROW_LIMIT, showAll);
    body.replaceChildren(...bodyRows(columns, shown));
    more.hidden = shown.length === rows.length;
  };
  more.addEventListener("click", () => {
    showAll = true;
    render();
  });
  render();
  return h(
    "div",
    "table-wrap",
    h(
      "table",
      "data",
      h("caption", "visually-hidden", caption),
      h(
        "thead",
        "",
        h(
          "tr",
          "",
          ...columns.map(({ label, numeric }) =>
            h("th", numeric === true ? "num" : "", label),
          ),
        ),
      ),
      body,
    ),
    more,
  );
};

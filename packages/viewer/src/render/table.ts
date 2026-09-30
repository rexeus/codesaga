import { h } from "./dom.js";

/** A table column: a header and how to show a row's cell. */
export type Column<Row> = {
  readonly label: string;
  readonly numeric?: boolean;
  readonly cell: (row: Row) => Node | string;
};

/** The rows shown before a "show all" button appears. */
const ROW_LIMIT = 100;

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
 * A table of `rows`. Only the first `ROW_LIMIT` rows are built until the
 * reader asks for all of them, so a report with thousands of rows stays fast.
 */
export const dataTable = <Row>(
  caption: string,
  columns: readonly Column<Row>[],
  rows: readonly Row[],
): HTMLElement => {
  const body = h("tbody", "", ...bodyRows(columns, rows.slice(0, ROW_LIMIT)));
  const table = h(
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
  );
  const wrap = h("div", "table-wrap", table);
  if (rows.length > ROW_LIMIT) {
    const more = h("button", "show-all", `Show all ${rows.length} rows`);
    more.type = "button";
    more.addEventListener("click", () => {
      body.replaceChildren(...bodyRows(columns, rows));
      more.remove();
    });
    wrap.append(more);
  }
  return wrap;
};

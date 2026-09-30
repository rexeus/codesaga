import { nextSort } from "../present/sort-state.js";
import type { Direction, SortState } from "../present/sort-state.js";
import { h } from "./dom.js";

/** A table column: a header and how to show a row's cell. */
export type Column<Row> = {
  readonly label: string;
  readonly numeric?: boolean;
  /** Makes the header a button that sorts by this key. */
  readonly sortKey?: string;
  readonly cell: (row: Row) => Node | string;
};

/** How a table sorts: its first state, the order a state gives and each column's first direction. */
export type Sorting<Row> = {
  readonly initial: SortState;
  readonly sort: (rows: readonly Row[], state: SortState) => Row[];
  readonly natural: (key: string) => Direction;
};

const ROW_LIMIT = 100;
const ARROWS: Record<Direction, string> = { asc: "▲", desc: "▼" };
const ARIA_SORT: Record<Direction, string> = {
  asc: "ascending",
  desc: "descending",
};

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

const directionOf = (
  state: SortState | undefined,
  key: string | undefined,
): Direction | null =>
  state !== undefined && key !== undefined && state.key === key
    ? state.direction
    : null;

/** A header cell; a sortable one holds a button and shows the sort direction. */
const headerCell = <Row>(
  { label, numeric, sortKey }: Column<Row>,
  onSort: ((key: string) => void) | null,
): { th: HTMLElement; show: (state: SortState | undefined) => void } => {
  const th = h("th", numeric === true ? "num" : "");
  if (sortKey === undefined || onSort === null) {
    th.textContent = label;
    return { th, show: () => undefined };
  }
  const arrow = h("span", "arrow");
  const button = h("button", "sort", label, arrow);
  button.type = "button";
  button.addEventListener("click", () => {
    onSort(sortKey);
  });
  th.append(button);
  return {
    th,
    show: (state) => {
      const direction = directionOf(state, sortKey);
      arrow.textContent = direction === null ? "" : ARROWS[direction];
      th.setAttribute(
        "aria-sort",
        direction === null ? "none" : ARIA_SORT[direction],
      );
    },
  };
};

/**
 * A table of `rows`. Only the first `ROW_LIMIT` rows are built until the
 * reader asks for all of them, so a report with thousands of rows stays fast.
 * With `sorting`, headers of columns with a `sortKey` sort the rows on click.
 */
export const dataTable = <Row>(
  caption: string,
  columns: readonly Column<Row>[],
  rows: readonly Row[],
  sorting?: Sorting<Row>,
): HTMLElement => {
  let state = sorting?.initial;
  let showAll = false;
  const body = h("tbody", "");
  const more = h("button", "show-all", `Show all ${rows.length} rows`);
  more.type = "button";

  const render = (): void => {
    const ordered =
      sorting === undefined || state === undefined
        ? rows
        : sorting.sort(rows, state);
    body.replaceChildren(
      ...bodyRows(columns, showAll ? ordered : ordered.slice(0, ROW_LIMIT)),
    );
    more.hidden = showAll || rows.length <= ROW_LIMIT;
    for (const { show } of headers) {
      show(state);
    }
  };
  const onSort =
    sorting === undefined
      ? null
      : (key: string): void => {
          state = nextSort(state ?? sorting.initial, key, sorting.natural(key));
          render();
        };
  const headers = columns.map((column) => headerCell(column, onSort));
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
      h("thead", "", h("tr", "", ...headers.map(({ th }) => th))),
      body,
    ),
    more,
  );
};

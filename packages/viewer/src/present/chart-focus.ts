/** The cells a chart offers to the keyboard, row by row: a time series has one row. */
export type Grid = { readonly rows: number; readonly columns: number };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * The cell that holds the focus after `key`, or null when the key leaves the
 * focus where it is: a key that does not navigate the chart, an arrow at an
 * edge, Up and Down on a one-row series. The page may then handle the key.
 * Arrow keys step one cell and stop at the edges, Home and End jump to the
 * first and last cell of the row, and with `ctrl` to those of the whole grid.
 * An `index` outside the grid moves to the nearest cell.
 */
export const moveFocus = (
  index: number,
  { rows, columns }: Grid,
  key: string,
  ctrl = false,
): number | null => {
  const last = rows * columns - 1;
  if (last < 0) {
    return null;
  }
  const current = clamp(index, 0, last);
  const row = Math.floor(current / columns);
  const first = row * columns;
  const targets: Readonly<Record<string, number>> = {
    ArrowLeft: Math.max(first, current - 1),
    ArrowRight: Math.min(first + columns - 1, current + 1),
    ArrowUp: row === 0 ? current : current - columns,
    ArrowDown: row === rows - 1 ? current : current + columns,
    Home: ctrl ? 0 : first,
    End: ctrl ? last : first + columns - 1,
  };
  const target = Object.hasOwn(targets, key) ? targets[key] : undefined;
  return target === undefined || target === index ? null : target;
};

/**
 * The cell a redrawn chart resumes on: the `visited` cell kept within the
 * `cells` the new layout offers, or `start` when nothing was visited.
 */
export const resumeCell = (
  visited: number | null,
  cells: number,
  start: number,
): number =>
  visited === null ? start : clamp(visited, 0, Math.max(0, cells - 1));

type Reading = {
  readonly title: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
};

/** A tooltip as one sentence for a live region: `Week of 2026-03-02: 12 commits`. */
export const describeReading = ({ title, rows }: Reading): string =>
  `${title}: ${rows.map(({ value, label }) => `${value} ${label}`).join(", ")}`;

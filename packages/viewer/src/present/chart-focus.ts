/** The cells a chart offers to the keyboard, row by row: a time series has one row. */
export type Grid = { readonly rows: number; readonly columns: number };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * The cell that holds the focus after `key`, or null when the key does not
 * navigate the chart. Arrow keys step one cell and stop at the edges, Home and
 * End jump to the first and last cell of the row, and with `ctrl` to those of
 * the whole grid.
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
  return Object.hasOwn(targets, key) ? (targets[key] ?? null) : null;
};

type Reading = {
  readonly title: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
};

/** A tooltip as one sentence for a live region: `Week of 2026-03-02: 12 commits`. */
export const describeReading = ({ title, rows }: Reading): string =>
  `${title}: ${rows.map(({ value, label }) => `${value} ${label}`).join(", ")}`;

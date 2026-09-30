import { formatCount } from "./format.js";

/** How many rows a table builds before the reader asks for the rest, and what to call them. */
export type RowLimit = {
  readonly rows: number;
  /** Plural, as in `Show all 72 directories`. */
  readonly noun: string;
};

/** The first `limit.rows` rows, or all of them once the reader asked. */
export const visibleRows = <Row>(
  rows: readonly Row[],
  { rows: limit }: RowLimit,
  showAll: boolean,
): readonly Row[] => (showAll ? rows : rows.slice(0, limit));

/** The label of the button that reveals every row. */
export const showAllLabel = (total: number, { noun }: RowLimit): string =>
  `Show all ${formatCount(total)} ${noun}`;

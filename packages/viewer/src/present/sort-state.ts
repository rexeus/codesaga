export type Direction = "asc" | "desc";

/** The column a table is sorted by and in which direction. */
export type SortState = { readonly key: string; readonly direction: Direction };

/**
 * The state after a click on `key`: the same column flips its direction,
 * another column starts in its `natural` direction.
 */
export const nextSort = (
  current: SortState,
  key: string,
  natural: Direction,
): SortState => {
  if (current.key !== key) {
    return { key, direction: natural };
  }
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
};

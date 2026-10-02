// Owns reading indentation: how wide one level is in a file, and how many levels a line has.
// The level algorithm is ported from codeheat (rexeus/codeheat, packages/engine/src/metrics/complexity.ts),
// which measures structural complexity as the sum of logical indentation levels over non-blank lines.

const MIN_INDENT_UNIT = 2;
const MAX_INDENT_UNIT = 8;
const FALLBACK_INDENT_UNIT = 4;

/**
 * The file's space-indentation width from the leading spaces of its code
 * lines: the most common increase between consecutive lines, clamped to 2..8.
 * Ties pick the smaller increase; a file without increases gets 4.
 */
export const detectIndentUnit = (leadingSpaces: ArrayLike<number>): number => {
  const counts = new Map<number, number>();
  for (let index = 1; index < leadingSpaces.length; index++) {
    const delta = (leadingSpaces[index] ?? 0) - (leadingSpaces[index - 1] ?? 0);
    if (delta > 0) {
      counts.set(delta, (counts.get(delta) ?? 0) + 1);
    }
  }
  const [mostCommon] = [...counts].toSorted(
    ([deltaA, countA], [deltaB, countB]) => countB - countA || deltaA - deltaB,
  );
  const unit = mostCommon === undefined ? FALLBACK_INDENT_UNIT : mostCommon[0];
  return Math.min(MAX_INDENT_UNIT, Math.max(MIN_INDENT_UNIT, unit));
};

/** The levels of a line with `tabs` leading tabs and `spaces` leading spaces: a tab is one level, spaces count `floor(spaces / unit)`. */
export const levelOf = (tabs: number, spaces: number, unit: number): number =>
  Math.floor(spaces / unit) + tabs;

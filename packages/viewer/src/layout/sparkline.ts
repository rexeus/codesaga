import type { Size } from "./plot.js";

const PAD_X = 2;
const PAD_TOP = 7;
const PAD_BOTTOM = 5;

/** A sparkline in pixels of its own box: the filled history, its line, the emphasised recent part and the last point. */
export type Sparkline = {
  readonly size: Size;
  readonly area: string;
  readonly history: string;
  readonly recent: string;
  readonly end: { readonly x: number; readonly y: number };
};

const path = (points: readonly (readonly [number, number])[]): string =>
  points
    .map(
      ([x, y], index) =>
        `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`,
    )
    .join("");

/**
 * Lays `values` out as a sparkline of `size`, lowest value at the bottom and
 * highest at the top, the last `recent` values as their own line. Null for
 * fewer than two values, which have no shape.
 */
export const layoutSparkline = (
  values: readonly number[],
  size: Size,
  recent: number,
): Sparkline | null => {
  if (values.length < 2) {
    return null;
  }
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const last = values.length - 1;
  const points = values.map((value, index): [number, number] => [
    PAD_X + (index / last) * (size.width - 2 * PAD_X),
    size.height -
      PAD_BOTTOM -
      ((value - low) / span) * (size.height - PAD_TOP - PAD_BOTTOM),
  ]);
  const [endX, endY] = points[last] ?? [0, 0];
  const [startX] = points[0] ?? [0];
  return {
    size,
    area: `${path(points)}L${endX.toFixed(1)},${size.height}L${startX.toFixed(1)},${size.height}Z`,
    history: path(points),
    recent: path(points.slice(-recent)),
    end: { x: endX, y: endY },
  };
};

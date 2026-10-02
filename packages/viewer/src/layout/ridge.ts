import { area, curveCatmullRom, line } from "d3-shape";

import type { Size } from "./plot.js";

const FLOOR = 6;
const HEADROOM = 40;

/** The soft weekly ridge behind the header: a filled area and its upper edge, in the pixels of `size`. */
export type Ridge = {
  readonly size: Size;
  readonly area: string;
  readonly edge: string;
};

/**
 * The ridge of `weekly` counts across `size`, highest week near the top and
 * the line smoothed through every week. Null for fewer than two weeks.
 */
export const layoutRidge = (
  weekly: readonly number[],
  size: Size,
): Ridge | null => {
  if (weekly.length < 2) {
    return null;
  }
  const peak = Math.max(1, ...weekly);
  const points = weekly.map((count, index): [number, number] => [
    (index / (weekly.length - 1)) * size.width,
    size.height - FLOOR - (count / peak) * (size.height - HEADROOM),
  ]);
  const curve = curveCatmullRom.alpha(0);
  return {
    size,
    edge: line().curve(curve)(points) ?? "",
    area:
      area()
        .curve(curve)
        .x(([x]) => x)
        .y0(size.height)
        .y1(([, y]) => Math.min(size.height, y))(points) ?? "",
  };
};

import type { Size } from "./plot.js";

/** One week of a contributor's sparkline; `recent` weeks are drawn in the accent. */
export type WeekBar = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly recent: boolean;
};

const MIN_WIDTH = 1.5;
const MIN_HEIGHT = 3;

/**
 * Lays one thin bar per week out across `size`, scaled to the contributor's
 * own busiest week. Weeks without commits get no bar; every other week gets
 * at least 3 px so a single commit stays visible.
 */
export const layoutWeeklyBars = (
  weekly: readonly number[],
  size: Size,
  recent: number,
): WeekBar[] => {
  const step = size.width / Math.max(1, weekly.length);
  const peak = Math.max(1, ...weekly);
  return weekly.flatMap((commits, index) => {
    if (commits === 0) {
      return [];
    }
    const height = Math.max(
      MIN_HEIGHT,
      (commits / peak) * (size.height - MIN_HEIGHT),
    );
    return [
      {
        x: index * step,
        y: size.height - height,
        width: Math.max(MIN_WIDTH, step - 1),
        height,
        recent: index >= weekly.length - recent,
      },
    ];
  });
};

import type { Zone } from "./plot.js";

/** A vertical bar in plot pixels; `direction` is where its rounded data end points. */
export type Bar = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly direction: "up" | "down";
};

const BAR_RADIUS = 4;
const MAX_BAR_WIDTH = 24;
const BAR_GAP = 2;
const MIN_GAPPED_STEP = 6;

/**
 * A thin bar centred in its zone between `top` and `bottom` (plot pixels):
 * at most 24 px wide, 2 px narrower than a zone of 6 px or more, with a
 * rounded data end of up to 4 px.
 */
export const barInZone = (
  { x, width: zoneWidth }: Zone,
  top: number,
  bottom: number,
  direction: Bar["direction"],
): Bar => {
  const gap = zoneWidth >= MIN_GAPPED_STEP ? BAR_GAP : 0;
  const width = Math.max(1, Math.min(MAX_BAR_WIDTH, zoneWidth - gap));
  const height = bottom - top;
  return {
    x: x + (zoneWidth - width) / 2,
    y: top,
    width,
    height,
    radius: Math.min(BAR_RADIUS, width / 2, height),
    direction,
  };
};

/** The SVG path of a bar: square at the baseline, rounded at the data end. */
export const barPath = (bar: Bar): string => {
  const { x, y, width, height, radius: r, direction } = bar;
  const right = x + width;
  if (direction === "up") {
    return `M${x},${y + height}V${y + r}a${r},${r} 0 0 1 ${r},${-r}H${right - r}a${r},${r} 0 0 1 ${r},${r}V${y + height}Z`;
  }
  return `M${x},${y}V${y + height - r}a${r},${r} 0 0 0 ${r},${r}H${right - r}a${r},${r} 0 0 0 ${r},${-r}V${y}Z`;
};

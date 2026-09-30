/** A vertical bar in plot pixels; `direction` is where its rounded data end points. */
export type Bar = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly direction: "up" | "down";
};

/** Largest corner radius of a data end (the baseline end stays square). */
export const BAR_RADIUS = 4;

/** The SVG path of a bar: square at the baseline, rounded at the data end. */
export const barPath = (bar: Bar): string => {
  const { x, y, width, height, radius: r, direction } = bar;
  const right = x + width;
  if (direction === "up") {
    return `M${x},${y + height}V${y + r}a${r},${r} 0 0 1 ${r},${-r}H${right - r}a${r},${r} 0 0 1 ${r},${r}V${y + height}Z`;
  }
  return `M${x},${y}V${y + height - r}a${r},${r} 0 0 0 ${r},${r}H${right - r}a${r},${r} 0 0 0 ${r},${-r}V${y}Z`;
};

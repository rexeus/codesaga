/** Pixel dimensions of a chart or of its plotting area. */
export type Size = { readonly width: number; readonly height: number };

/** An axis tick: a position in plot pixels and its label. */
export type Tick = { readonly position: number; readonly label: string };

/** A horizontal span of the plot that responds to the pointer. */
export type Zone = { readonly x: number; readonly width: number };

const MARGIN = { top: 8, right: 12, bottom: 24, left: 44 } as const;

/** Where the plot's origin sits inside its chart. */
export const PLOT_ORIGIN = { x: MARGIN.left, y: MARGIN.top } as const;

/** The plotting area that remains of a chart after the axis margins. */
export const plotSize = ({ width, height }: Size): Size => ({
  width: Math.max(0, width - MARGIN.left - MARGIN.right),
  height: Math.max(0, height - MARGIN.top - MARGIN.bottom),
});

/** The chart size whose plotting area is `plotHeight` tall and as wide as `width` allows. */
export const chartSizeFor = (width: number, plotHeight: number): Size => ({
  width,
  height: plotHeight + MARGIN.top + MARGIN.bottom,
});

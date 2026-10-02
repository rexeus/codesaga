import { medianBucket } from "../present/histograms.js";
import type { HistogramBin } from "../present/histograms.js";
import { barInZone } from "./bars.js";
import type { Bar } from "./bars.js";
import { plotSize } from "./plot.js";
import type { Size, Tick, Zone } from "./plot.js";
import { countScale, countTicks } from "./time-axis.js";

const BAR_MAX_WIDTH = 54;
const Y_TICKS = 3;

/** A bucket as a bar with the figures its marks and tooltip need. */
type HistogramBar = {
  readonly bar: Bar;
  readonly label: string;
  readonly files: number;
  /** The bucket that holds the middle file. */
  readonly median: boolean;
  /** The buckets whose count is printed above the bar: the tallest and the median. */
  readonly annotated: boolean;
  /** The bar's centre in plot pixels, where its count is printed. */
  readonly x: number;
};

/** A histogram's marks in plot pixels. */
export type HistogramLayout = {
  readonly plot: Size;
  readonly bars: readonly HistogramBar[];
  readonly zones: readonly Zone[];
  /** The count axis. */
  readonly ticks: readonly Tick[];
  /** The bucket labels, centred under their bars. */
  readonly labelTicks: readonly Tick[];
};

/**
 * Lays the buckets out left to right in equal zones across a chart of `size`,
 * each a thin bar up from the baseline against one count scale. The median
 * bucket and the tallest are marked for annotation, or every non-empty one
 * with `annotateAll`.
 */
export const layoutHistogram = (
  bins: readonly HistogramBin[],
  size: Size,
  annotateAll = false,
): HistogramLayout => {
  const plot = plotSize(size);
  const zoneWidth = plot.width / Math.max(1, bins.length);
  const zones = bins.map((_, index) => ({
    x: index * zoneWidth,
    width: zoneWidth,
  }));
  const counts = bins.map(({ files }) => files);
  const tallest = Math.max(0, ...counts);
  const y = countScale([0, Math.max(1, tallest)], plot.height);
  const median = medianBucket(counts);
  const bars = bins.map(({ label, files }, index) => {
    const zone = zones[index] ?? { x: 0, width: 0 };
    return {
      bar: barInZone(zone, [y(files), plot.height], "up", BAR_MAX_WIDTH),
      label,
      files,
      median: index === median,
      annotated:
        files > 0 && (annotateAll || index === median || files === tallest),
      x: zone.x + zone.width / 2,
    };
  });
  return {
    plot,
    bars,
    zones,
    ticks: countTicks(y, Y_TICKS),
    labelTicks: bars.map(({ x, label }) => ({ position: x, label })),
  };
};

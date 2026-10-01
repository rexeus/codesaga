import { scaleSqrt } from "d3-scale";

import { chartSizeFor, plotSize } from "./plot.js";
import type { Size, Tick } from "./plot.js";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MAX_ROW_HEIGHT = 30;
const DOT_MARGIN = 1;
const MIN_DOT_RADIUS = 1.5;
const HOUR_LABEL_STEP = 3;

/** A weekday and hour with its commits; `x` and `y` are the cell's top left. */
type PunchCell = {
  readonly weekday: (typeof WEEKDAYS)[number];
  readonly hour: number;
  readonly commits: number;
  readonly x: number;
  readonly y: number;
};

export type PunchcardLayout = {
  /** The chart size: the plot with its axis margins. */
  readonly size: Size;
  readonly plot: Size;
  readonly cell: Size;
  /** The cell with the most commits; null while there are none. */
  readonly busiest: PunchCell | null;
  /** Every weekday and hour, row by row; the hover areas. */
  readonly cells: readonly PunchCell[];
  /** The dots: only cells with commits, centred in their cell, area proportional to commits. */
  readonly dots: readonly {
    readonly cell: PunchCell;
    readonly cx: number;
    readonly cy: number;
    readonly radius: number;
  }[];
  readonly weekdayTicks: readonly Tick[];
  readonly hourTicks: readonly Tick[];
};

const pad = (hour: number): string => String(hour).padStart(2, "0");

/** The hour a cell covers, as `14:00–14:59`. */
export const hourSpan = (hour: number): string =>
  `${pad(hour)}:00–${pad(hour)}:59`;

/**
 * Lays out the 7 × 24 punch card as a dot grid in a chart `width` pixels wide. The
 * busiest cell gets the largest dot that fits its cell, the others a
 * proportionally smaller area, and cells without commits get no dot.
 */
export const layoutPunchcard = (
  punchcard: readonly (readonly number[])[],
  width: number,
): PunchcardLayout => {
  const plotWidth = plotSize({ width, height: 0 }).width;
  const cell: Size = {
    width: plotWidth / 24,
    height: Math.min(MAX_ROW_HEIGHT, plotWidth / 24),
  };
  const plot: Size = {
    width: plotWidth,
    height: cell.height * WEEKDAYS.length,
  };
  const cells = WEEKDAYS.flatMap((weekday, row) =>
    Array.from({ length: 24 }, (_, hour): PunchCell => ({
      weekday,
      hour,
      commits: punchcard[row]?.[hour] ?? 0,
      x: hour * cell.width,
      y: row * cell.height,
    })),
  );
  const maxRadius = Math.min(cell.width, cell.height) / 2 - DOT_MARGIN;
  const radius = scaleSqrt()
    .domain([0, Math.max(1, ...cells.map(({ commits }) => commits))])
    .range([0, Math.max(0, maxRadius)]);
  const busiest = cells.reduce<PunchCell | null>(
    (best, punch) => (punch.commits > (best?.commits ?? 0) ? punch : best),
    null,
  );
  return {
    busiest,
    size: chartSizeFor(width, plot.height),
    plot,
    cell,
    cells,
    dots: cells
      .filter(({ commits }) => commits > 0)
      .map((punch) => ({
        cell: punch,
        cx: punch.x + cell.width / 2,
        cy: punch.y + cell.height / 2,
        radius: Math.max(MIN_DOT_RADIUS, radius(punch.commits)),
      })),
    weekdayTicks: WEEKDAYS.map((label, row) => ({
      position: row * cell.height + cell.height / 2,
      label,
    })),
    hourTicks: Array.from(
      { length: 24 / HOUR_LABEL_STEP },
      (_, index): Tick => ({
        position: index * HOUR_LABEL_STEP * cell.width + cell.width / 2,
        label: pad(index * HOUR_LABEL_STEP),
      }),
    ),
  };
};

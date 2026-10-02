import { chartSizeFor, plotSize } from "./plot.js";
import type { Size, Tick } from "./plot.js";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const HOURS = 24;
const MAX_ROW_HEIGHT = 26;
const HOUR_LABEL_STEP = 6;
/** The heat of a cell, from 1 (the lightest) to this many, 0 for no commits. */
export const HEAT_LEVELS = 5;

/** A weekday and hour with its commits; `x` and `y` are the cell's top left. */
type PunchCell = {
  readonly weekday: (typeof WEEKDAYS)[number];
  readonly hour: number;
  readonly commits: number;
  /** 0 for no commits, otherwise 1 to `HEAT_LEVELS` in proportion to the busiest cell. */
  readonly level: number;
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
  /** Every weekday and hour, row by row. */
  readonly cells: readonly PunchCell[];
  readonly weekdayTicks: readonly Tick[];
  readonly hourTicks: readonly Tick[];
};

const pad = (hour: number): string => String(hour).padStart(2, "0");

/** The hour a cell covers, as `14:00–14:59`. */
export const hourSpan = (hour: number): string =>
  `${pad(hour)}:00–${pad(hour)}:59`;

const levelOf = (commits: number, busiest: number): number =>
  commits === 0 ? 0 : Math.max(1, Math.ceil((commits / busiest) * HEAT_LEVELS));

/**
 * Lays out the 7 × 24 heatmap in a chart `width` pixels wide: square cells
 * (at most 26 px tall) shaded in five steps by their share of the busiest
 * cell's commits, and unshaded for none.
 */
export const layoutPunchcard = (
  punchcard: readonly (readonly number[])[],
  width: number,
): PunchcardLayout => {
  const plotWidth = plotSize({ width, height: 0 }).width;
  const cell: Size = {
    width: plotWidth / HOURS,
    height: Math.min(MAX_ROW_HEIGHT, plotWidth / HOURS),
  };
  const plot: Size = {
    width: plotWidth,
    height: cell.height * WEEKDAYS.length,
  };
  const counts = WEEKDAYS.flatMap((_, row) =>
    Array.from({ length: HOURS }, (__, hour) => punchcard[row]?.[hour] ?? 0),
  );
  const peak = Math.max(1, ...counts);
  const cells = WEEKDAYS.flatMap((weekday, row) =>
    Array.from({ length: HOURS }, (_, hour): PunchCell => {
      const commits = counts[row * HOURS + hour] ?? 0;
      return {
        weekday,
        hour,
        commits,
        level: levelOf(commits, peak),
        x: hour * cell.width,
        y: row * cell.height,
      };
    }),
  );
  return {
    busiest: cells.reduce<PunchCell | null>(
      (best, punch) => (punch.commits > (best?.commits ?? 0) ? punch : best),
      null,
    ),
    size: chartSizeFor(width, plot.height),
    plot,
    cell,
    cells,
    weekdayTicks: WEEKDAYS.map((label, row) => ({
      position: row * cell.height + cell.height / 2,
      label,
    })),
    hourTicks: Array.from(
      { length: HOURS / HOUR_LABEL_STEP },
      (_, index): Tick => ({
        position: index * HOUR_LABEL_STEP * cell.width,
        label: `${pad(index * HOUR_LABEL_STEP)}:00`,
      }),
    ),
  };
};

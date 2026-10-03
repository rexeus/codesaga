// Owns what the stories and achievements read of `deepDives.typescript.trends`: the months, the series they use and the flag events.
// A structural subset of the report's `Trends`, so the readers do not depend on the part they ignore.

/** A flag change in one `tsconfig`, as the trends report it. */
type FlagChange = {
  readonly date: string;
  readonly path: string;
  readonly flag: string;
  readonly from: boolean | null;
  readonly to: boolean;
};

/** The months of the history, oldest first, with one array of totals per series, aligned with them. */
export type TrendInput = {
  readonly months: ReadonlyArray<string>;
  readonly series: Readonly<Record<string, ReadonlyArray<number>>>;
  /** Every flip of the flags, oldest first; the report's `trends.events` keeps only the newest 20, so callers pass `allFlagEvents`. */
  readonly events: ReadonlyArray<FlagChange>;
};

/** One month of the production escape hatches. */
export type EscapePoint = {
  /** `YYYY-MM`. */
  readonly month: string;
  readonly escapes: number;
  readonly lines: number;
  /** Escape sites per 1,000 production lines; 0 without lines. */
  readonly per1000: number;
};

/** The names of the series the readers use. */
export const SERIES = {
  escapes: "production.escapes",
  lines: "production.lines",
  esmFiles: "production.esmFiles",
  commonjsFiles: "production.commonjsFiles",
} as const;

/** The total of `name` at the month at `index`; 0 for a series or month that is not there. */
export const seriesAt = (
  trends: TrendInput,
  name: string,
  index: number,
): number => trends.series[name]?.[index] ?? 0;

/** The production escape hatches month by month, oldest first. */
export const escapePointsOf = (
  trends: TrendInput,
): ReadonlyArray<EscapePoint> =>
  trends.months.map((month, index) => {
    const escapes = seriesAt(trends, SERIES.escapes, index);
    const lines = seriesAt(trends, SERIES.lines, index);
    return {
      month,
      escapes,
      lines,
      per1000: lines === 0 ? 0 : (escapes * 1000) / lines,
    };
  });

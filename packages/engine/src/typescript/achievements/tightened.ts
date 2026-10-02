// Owns the `tightened` achievement: the production escape hatches per 1,000 lines fell by half from their peak.
// A milestone read from the history alone; the repository's HEAD figures cannot tell a fall from a small start.

import { ACHIEVEMENT_THRESHOLDS } from "../../achievements/thresholds.js";
import type { TypeScriptAchievement } from "../../report/typescript-achievements.js";
import { escapePointsOf } from "../trend-input.js";
import type { EscapePoint, TrendInput } from "../trend-input.js";

const { tightenedFall, tightenedMinPeakEscapes } = ACHIEVEMENT_THRESHOLDS;

const TITLE = "Tightened";

/** The last day of a `YYYY-MM` month, or `today` when that is earlier. */
const reachedOn = (month: string, today: string): string => {
  const [year = 0, calendarMonth = 0] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, calendarMonth, 0))
    .toISOString()
    .slice(0, 10);
  return end < today ? end : today;
};

const figure = (value: number): string =>
  (Math.round(value * 10) / 10).toString();

const peakOf = (points: ReadonlyArray<EscapePoint>): number => {
  let peak = -1;
  for (const [index, point] of points.entries()) {
    if (
      point.escapes >= tightenedMinPeakEscapes &&
      point.per1000 > (points[peak]?.per1000 ?? -1)
    ) {
      peak = index;
    }
  }
  return peak;
};

const locked = (detail: string, fallPercent: number | null) => ({
  kind: "tightened" as const,
  title: TITLE,
  reached: false,
  reachedAt: null,
  holds: "milestone" as const,
  detail,
  progress:
    fallPercent === null
      ? null
      : {
          value: Math.max(0, Math.floor(fallPercent)),
          target: Math.round(tightenedFall * 100),
          unit: "% below the peak",
        },
});

/**
 * The achievement as a list of at most one entry, so it appends to the
 * state achievements. Empty without trends. The peak is the month with the
 * highest escape rate among those that held at least
 * `tightenedMinPeakEscapes` escape hatches; the achievement is reached when
 * a later month's rate is at most `1 - tightenedFall` times the peak's.
 * `today` is `YYYY-MM-DD` and caps `reachedAt` for the current month.
 */
export const tightened = (
  trends: TrendInput | undefined,
  today: string,
): ReadonlyArray<TypeScriptAchievement> => {
  if (trends === undefined) {
    return [];
  }
  const points = escapePointsOf(trends);
  const at = peakOf(points);
  const peak = points[at];
  const latest = points.at(-1);
  if (peak === undefined || latest === undefined) {
    return [
      locked(
        `The production code has not held ${tightenedMinPeakEscapes} escape hatches, so there is no peak to fall from.`,
        null,
      ),
    ];
  }
  const target = peak.per1000 * (1 - tightenedFall);
  const reached = points.slice(at + 1).find(({ per1000 }) => per1000 <= target);
  const fall = ((peak.per1000 - latest.per1000) / peak.per1000) * 100;
  if (reached === undefined) {
    return [
      locked(
        `${figure(latest.per1000)} escape hatches per 1,000 production lines, ${figure(peak.per1000)} at the peak in ${peak.month}.`,
        fall,
      ),
    ];
  }
  return [
    {
      kind: "tightened",
      title: TITLE,
      reached: true,
      reachedAt: reachedOn(reached.month, today),
      holds: "milestone",
      detail: `Escape hatches per 1,000 production lines fell from ${figure(peak.per1000)} in ${peak.month} to ${figure(reached.per1000)} in ${reached.month}.`,
      progress: null,
    },
  ];
};

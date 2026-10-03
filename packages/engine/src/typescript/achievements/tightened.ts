// Owns the `tightened` achievement: the production escape hatches per 1,000 lines fell by half from an earlier peak.
// A milestone read from the history alone, kept at the earliest month that shows it, so appending months never moves it or takes it back.

import { ACHIEVEMENT_THRESHOLDS } from "../../achievements/thresholds.js";
import type { TypeScriptAchievement } from "../../report/typescript-achievements.js";
import { escapePointsOf } from "../trend-input.js";
import type { EscapePoint, TrendInput } from "../trend-input.js";

const { tightenedFall, tightenedMinPeakEscapes } = ACHIEVEMENT_THRESHOLDS;

const TITLE = "Tightened";

const figure = (value: number): string =>
  (Math.round(value * 10) / 10).toString();

/** A point can be a peak to fall from when it held enough escape hatches. */
const isPeakable = ({ escapes }: EscapePoint): boolean =>
  escapes >= tightenedMinPeakEscapes;

/** The earliest month whose rate is at most `1 - tightenedFall` times the highest peakable rate before it, with that peak. */
const firstFall = (
  points: ReadonlyArray<EscapePoint>,
):
  | {
      readonly peak: EscapePoint;
      readonly fell: EscapePoint;
      readonly index: number;
    }
  | undefined => {
  let peak: EscapePoint | undefined;
  for (const [index, point] of points.entries()) {
    if (
      peak !== undefined &&
      point.per1000 <= peak.per1000 * (1 - tightenedFall)
    ) {
      return { peak, fell: point, index };
    }
    if (isPeakable(point) && point.per1000 > (peak?.per1000 ?? -1)) {
      peak = point;
    }
  }
  return undefined;
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

const lockedFor = (
  points: ReadonlyArray<EscapePoint>,
): TypeScriptAchievement => {
  const peak = points
    .filter((point) => isPeakable(point))
    .reduce<EscapePoint | undefined>(
      (best, point) =>
        best === undefined || point.per1000 > best.per1000 ? point : best,
      undefined,
    );
  const latest = points.at(-1);
  if (peak === undefined || latest === undefined) {
    return locked(
      `The production code has not held ${tightenedMinPeakEscapes} escape hatches, so there is no peak to fall from.`,
      null,
    );
  }
  return locked(
    `${figure(latest.per1000)} escape hatches per 1,000 production lines, ${figure(peak.per1000)} at the peak in ${peak.month} (series from ${points[0]?.month ?? peak.month}).`,
    ((peak.per1000 - latest.per1000) / peak.per1000) * 100,
  );
};

/**
 * The achievement as a list of at most one entry, so it appends to the state
 * achievements. Empty without trends. A peak is a month that held at least
 * `tightenedMinPeakEscapes` escape hatches; the achievement is reached at the
 * first month whose rate is at most `1 - tightenedFall` times the highest
 * peak before it, however high a later peak grows. `reachedAt` is the day of
 * the last commit of the first-parent chain dated in that month or before it,
 * which is what the month's point is the state after.
 */
export const tightened = (
  trends: TrendInput | undefined,
): ReadonlyArray<TypeScriptAchievement> => {
  if (trends === undefined) {
    return [];
  }
  const points = escapePointsOf(trends);
  const found = firstFall(points);
  const reachedAt =
    found === undefined ? undefined : trends.lastCommitDays[found.index];
  if (found === undefined || reachedAt === undefined || reachedAt === "") {
    return [lockedFor(points)];
  }
  return [
    {
      kind: "tightened",
      title: TITLE,
      reached: true,
      reachedAt,
      holds: "milestone",
      detail: `Escape hatches per 1,000 production lines fell from ${figure(found.peak.per1000)} in ${found.peak.month} to ${figure(found.fell.per1000)} in ${found.fell.month}.`,
      progress: null,
    },
  ];
};

// Owns the stories that need the history of the TypeScript code: strict since, the escape-hatch trend and the module era.
// Each is its own function over the trends and returns nothing without them, so a run that did not read the history simply has none.
// Cost: one pass over the monthly series.

import { roundReported } from "../report/precision.js";
import { percentOf } from "../report/sentences.js";
import type { Story } from "../report/stories.js";
import type { TypeScriptDeepDive } from "../report/typescript-deep-dive.js";
import { SERIES, escapePointsOf, seriesAt } from "../typescript/trend-input.js";
import type { FlagChange, TrendInput } from "../typescript/trend-input.js";
import type { StoryFacts } from "./stories.js";
import { STORY_THRESHOLDS } from "./thresholds.js";

const {
  typeTrendMonths,
  typeTrendMinChange,
  typeTrendMinEscapes,
  typeTrendMinLines,
  moduleEraMinFiles,
  moduleEraCommonjsShare,
} = STORY_THRESHOLDS;

/** A rate with at most one decimal: `4`, `4.1`. */
const figure = (value: number): string =>
  (Math.round(value * 10) / 10).toString();

/** The whole months from a `YYYY-MM-DD` day to a `YYYY-MM` month. */
const monthsBetween = (day: string, month: string): number => {
  const [fromYear = 0, fromMonth = 0] = day.split("-").map(Number);
  const [toYear = 0, toMonth = 0] = month.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
};

/**
 * `strict` is on in the config that governs the most files, since the commit
 * that last turned it on. A flip in a base config shows on every config that
 * extends it, so the story names the first config of the extends chain, base
 * first, that flipped on that day. A config that never flipped on its own
 * (it was created strict, or its base was) is read through the configs it
 * extends, the nearest first.
 */
const strictSince = (
  { strictness }: TypeScriptDeepDive,
  trends: TrendInput,
): ReadonlyArray<Story> => {
  const [main] = strictness?.configs ?? [];
  const last = trends.months.at(-1);
  const strictEventsOf = (path: string) =>
    trends.events.filter(
      (event) => event.path === path && event.flag === "strict",
    );
  const lastFlipOf = (path: string) => strictEventsOf(path).at(-1);
  const turnedOn =
    main === undefined
      ? undefined
      : [main.path, ...main.extends.toReversed()]
          .map((path) => lastFlipOf(path))
          .find((event) => event !== undefined);
  if (
    main === undefined ||
    last === undefined ||
    main.files === 0 ||
    main.strict !== true ||
    turnedOn?.to !== true
  ) {
    return [];
  }
  const flip = [...main.extends, main.path]
    .map((path) =>
      trends.events.find(
        (event) =>
          event.path === path &&
          event.flag === "strict" &&
          event.to &&
          event.date === turnedOn.date,
      ),
    )
    .find((event) => event !== undefined);
  const flipped = flip ?? turnedOn;
  return [
    {
      kind: "strict-since",
      ...strictWording(flipped, trends.months[0]),
      value: monthsBetween(flipped.date, last),
      date: flipped.date,
      path: flipped.path,
    },
  ];
};

/**
 * What the flip says: a switch from off to on, a config created strict, or
 * a config that was strict in the first commit the history read, which says
 * nothing of how it came to be: the chain may start long after the
 * repository did, and a shallow clone starts at its boundary.
 */
const strictWording = (
  { path, date, from }: FlagChange,
  firstMonth: string | undefined,
): Pick<Story, "title" | "detail"> => {
  if (from !== null) {
    return {
      title: "Strict since",
      detail: `strict was switched on in ${path} on ${date}.`,
    };
  }
  return date.slice(0, 7) === firstMonth
    ? {
        title: "Strict since the first commit read",
        detail: `strict has been on in ${path} since the first commit read, in ${firstMonth}.`,
      }
    : {
        title: "Strict since",
        detail: `strict has been on in ${path} since the config was created on ${date}.`,
      };
};

/** The production escape hatches per 1,000 lines against the same month a year ago, when they changed by at least `typeTrendMinChange`. */
const typeTrend = (trends: TrendInput): ReadonlyArray<Story> => {
  const points = escapePointsOf(trends);
  const now = points.at(-1);
  const before = points.at(-1 - typeTrendMonths);
  if (
    now === undefined ||
    before === undefined ||
    before.per1000 === 0 ||
    Math.min(now.lines, before.lines) < typeTrendMinLines ||
    Math.max(now.escapes, before.escapes) < typeTrendMinEscapes
  ) {
    return [];
  }
  const change = (now.per1000 - before.per1000) / before.per1000;
  if (Math.abs(change) < typeTrendMinChange) {
    return [];
  }
  return [
    {
      kind: "type-trend",
      title: "Escape hatches",
      detail: `Production escape hatches per 1,000 lines ${change < 0 ? "fell" : "rose"} by ${percentOf(Math.abs(change))} in the last ${typeTrendMonths} months, from ${figure(before.per1000)} to ${figure(now.per1000)}.`,
      value: roundReported(change),
    },
  ];
};

/** The production module files that use CommonJS: since when there are none, or their share when it is at least `moduleEraCommonjsShare`. */
const moduleEra = (trends: TrendInput): ReadonlyArray<Story> => {
  const lastIndex = trends.months.length - 1;
  const esm = seriesAt(trends, SERIES.esmFiles, lastIndex);
  const commonjs = seriesAt(trends, SERIES.commonjsFiles, lastIndex);
  if (esm + commonjs < moduleEraMinFiles) {
    return [];
  }
  if (commonjs > 0) {
    const share = commonjs / (esm + commonjs);
    return share < moduleEraCommonjsShare
      ? []
      : [
          {
            kind: "module-era",
            title: "CommonJS code",
            detail: `${percentOf(share)} of the production module files use CommonJS.`,
            value: roundReported(share),
          },
        ];
  }
  const lastWithCommonjs = trends.months.findLastIndex(
    (_, index) => seriesAt(trends, SERIES.commonjsFiles, index) > 0,
  );
  const since = trends.months[lastWithCommonjs + 1];
  const day = trends.lastCommitDays[lastWithCommonjs + 1];
  return lastWithCommonjs < 0 ||
    since === undefined ||
    day === undefined ||
    day === ""
    ? []
    : [
        {
          kind: "module-era",
          title: "ESM only",
          detail: `No production file has used CommonJS since the end of ${since}.`,
          value: 0,
          date: day,
        },
      ];
};

/** The stories of the history; empty without trends or without the deep dive. */
export const trendStories = ({
  typescript,
  trends,
}: StoryFacts): ReadonlyArray<Story> =>
  typescript === undefined || trends === undefined
    ? []
    : [
        ...strictSince(typescript, trends),
        ...typeTrend(trends),
        ...moduleEra(trends),
      ];

// Owns the `deepDives.typescript.trends` section: the replayed facts of the history as monthly series, the flag events of the configs and the escapes per class.
import { DateTime } from "effect";

import type { ClassifiedCommit } from "../../automation/classify.js";
import type { Trends } from "../../report/typescript-trends.js";
import type { HistoryFacts } from "../history-facts.js";
import { escapesByAutomation } from "./escapes-by-automation.js";
import { factsLookupOf } from "./facts-lookup.js";
import { MEASURES } from "./file-counts.js";
import { lastCommitDays, monthOf, monthlyTotals } from "./replay.js";
import type { Totals } from "./replay.js";
import { flagEventsOf } from "./tsconfig-events.js";

/** What the trends read of the analysis. */
export type TrendsInput = {
  /** The scoped commits inside the activity window. */
  readonly window: ReadonlyArray<ClassifiedCommit>;
  readonly historyFacts: HistoryFacts;
  /** The repository scope: "." or a directory or file below the root. */
  readonly scope: string;
  readonly now: DateTime.Utc;
};

/** The measures that only test files have. */
const TEST_ONLY = new Set(["testCases", "focusedTests"]);

const monthLabel = (month: number): string =>
  `${Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, "0")}`;

const isUnder = (path: string, scope: string): boolean =>
  scope === "." || path === scope || path.startsWith(`${scope}/`);

/** One array per series name, a point per month. */
const seriesOf = (points: ReadonlyArray<Totals>): Trends["series"] =>
  Object.fromEntries(
    (["production", "tests"] as const).flatMap((group, groupIndex) =>
      MEASURES.filter(
        (measure) => group === "tests" || !TEST_ONLY.has(measure),
      ).map((measure) => [
        `${group}.${measure}`,
        points.map(
          (point) => point[groupIndex]?.[MEASURES.indexOf(measure)] ?? 0,
        ),
      ]),
    ),
  );

/** The newest this many flag events are in the report. */
const REPORTED_EVENTS = 20;

/** What `trendsOf` builds: the report's block, and every flag event before it is cut to the newest. */
export type TrendsResult = {
  readonly trends: Trends;
  /** Every flip of `strict` and `noUncheckedIndexedAccess` over the whole history, oldest first; `trends.events` holds only the newest 20. */
  readonly allFlagEvents: ReadonlyArray<Trends["events"][number]>;
  /**
   * For each month of `trends.months`, the day of the first-parent commit its
   * point is the state after: the last commit dated in that month or before
   * it. The stories and achievements date what they find by it; the report
   * does not carry it.
   */
  readonly lastCommitDays: ReadonlyArray<string>;
};

/**
 * The trends of the scope's TypeScript and JavaScript, or undefined when no
 * commit of the first-parent chain has a readable date within the history.
 * Months run from the earliest dated commit's to the current one, and each
 * point is the state of the chain after the last commit dated in that month or
 * before it (see `monthlyTotals`); the last point is the head's committed tree.
 */
export const trendsOf = (input: TrendsInput): TrendsResult | undefined => {
  const { historyFacts, scope } = input;
  const chain = historyFacts.firstParent.map(({ time, changes }) => ({
    time,
    changes: changes.filter(({ path }) => isUnder(path, scope)),
  }));
  const lastMonth = monthOf(DateTime.toEpochMillis(input.now) / 1000);
  const dated = chain
    .map(({ time }) => time)
    .filter((time) => time >= 0 && monthOf(time) <= lastMonth);
  if (dated.length === 0) {
    return undefined;
  }
  const lookup = factsLookupOf(historyFacts);
  const firstMonth = monthOf(
    dated.reduce((first, time) => Math.min(first, time), Infinity),
  );
  const points = monthlyTotals({
    commits: chain,
    lookup,
    firstMonth,
    lastMonth,
  });
  const allFlagEvents = flagEventsOf({
    commits: chain,
    texts: historyFacts.configs,
  });
  return {
    trends: {
      months: points.map((_, index) => monthLabel(firstMonth + index)),
      series: seriesOf(points),
      events: allFlagEvents.slice(-REPORTED_EVENTS),
      escapesByAutomation: escapesByAutomation(input.window, lookup),
    },
    allFlagEvents,
    lastCommitDays: lastCommitDays(chain, firstMonth, lastMonth),
  };
};

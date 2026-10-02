import type { Report } from "@codesaga/engine";

import {
  formatAge,
  formatCount,
  formatDate,
  formatDateLong,
  formatPercent,
} from "./format.js";
import type { IconName } from "./icons.js";
import { initialsOf, slotOf } from "./people.js";
import { hourTotals, isNightHour, isWeekend, weekdayTotals } from "./rhythm.js";
import type { Segment } from "./story.js";

type Highlight = Report["highlights"][number];

/** The small picture of a highlight card. */
export type HighlightViz =
  | {
      readonly kind: "timeline";
      /** Where each anniversary lies on the line from the first commit (0) to today (1). */
      readonly anniversaries: readonly number[];
    }
  | { readonly kind: "dots"; readonly count: number }
  | { readonly kind: "share"; readonly part: number; readonly rest: number }
  | {
      readonly kind: "people";
      readonly people: readonly { initials: string; slot: number }[];
      readonly more: number;
    }
  | {
      readonly kind: "bars";
      /** Each bar's height, 0 to 1, and whether it is the highlighted part. */
      readonly bars: readonly { height: number; on: boolean }[];
    }
  | { readonly kind: "path"; readonly text: string }
  | { readonly kind: "pill"; readonly text: string };

/** One highlight, ready to draw: icon and accent slot, the big figure, a sentence, a picture and its evidence. */
export type HighlightCard = {
  readonly kind: Highlight["kind"];
  readonly icon: IconName;
  /** The categorical slot (1 to 7) the card is tinted with. */
  readonly slot: number;
  readonly title: string;
  readonly big: string;
  readonly unit: string;
  readonly text: readonly Segment[];
  readonly viz: HighlightViz | null;
  readonly evidence: string;
};

type Parts = Pick<HighlightCard, "big" | "unit" | "viz" | "evidence">;
type Build = (highlight: Highlight, report: Report) => Parts;

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365;
const DAYS_PER_WEEK = 7;
const MAX_DOTS = 36;
const MIN_BAR = 0.08;

const valueOf = ({ value }: Highlight): number => value ?? 0;

const dayNumber = (iso: string): number =>
  Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

const addDays = (iso: string, days: number): string =>
  new Date(dayNumber(iso) + days * MS_PER_DAY).toISOString().slice(0, 10);

const noun = (count: number, one: string, many: string): string =>
  count === 1 ? one : many;

const escapePattern = (text: string): string =>
  text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

const ISO_DATE = String.raw`\d{4}-\d{2}-\d{2}`;
const QUOTED = '"[^"]+"';

/**
 * The detail with its path, dates and quoted phrases set strong. The engine
 * words the sentence; this only picks out the facts in it.
 */
const emphasize = ({ detail, path }: Highlight): Segment[] => {
  const facts = path === undefined ? [] : [escapePattern(path)];
  const pattern = new RegExp([...facts, ISO_DATE, QUOTED].join("|"), "gu");
  const segments: Segment[] = [];
  let from = 0;
  for (const match of detail.matchAll(pattern)) {
    segments.push(
      { text: detail.slice(from, match.index), strong: false },
      { text: match[0], strong: true },
    );
    from = match.index + match[0].length;
  }
  segments.push({ text: detail.slice(from), strong: false });
  return segments.filter(({ text }) => text !== "");
};

const peopleViz = (
  { people = [] }: Highlight,
  total: number,
): HighlightViz => ({
  kind: "people",
  people: people.map(({ name, email }) => ({
    initials: initialsOf(name),
    slot: slotOf(email),
  })),
  more: Math.max(0, total - people.length),
});

const barsViz = (
  totals: readonly number[],
  on: (index: number) => boolean,
): HighlightViz => {
  const peak = Math.max(1, ...totals);
  return {
    kind: "bars",
    bars: totals.map((total, index) => ({
      height: Math.max(MIN_BAR, total / peak),
      on: on(index),
    })),
  };
};

const anniversary: Build = (highlight, { repository, generatedAt }) => {
  const since = repository.firstCommitAt ?? generatedAt;
  const days = Math.round(
    (dayNumber(generatedAt) - dayNumber(since)) / MS_PER_DAY,
  );
  const years = valueOf(highlight);
  const months = formatAge(since, generatedAt).split(" and ")[1];
  return {
    big: `${years} ${noun(years, "year", "years")}`,
    unit: months === undefined ? "" : `+ ${months}`,
    viz: {
      kind: "timeline",
      anniversaries: Array.from(
        { length: years },
        (_, index) => (DAYS_PER_YEAR * (index + 1)) / Math.max(1, days),
      ),
    },
    evidence: `first commit ${formatDate(since)} · ${formatCount(days)} days of history`,
  };
};

const streak: Build = (highlight) => {
  const days = valueOf(highlight);
  const first = highlight.date ?? "";
  return {
    big: String(days),
    unit: "days in a row",
    viz: { kind: "dots", count: Math.min(days, MAX_DOTS) },
    evidence: `${first} to ${addDays(first, days - 1)}`,
  };
};

/** The share of the busiest day in the commits of its week, when the week is in the window. */
const busiestDay: Build = (highlight, { activity }) => {
  const commits = valueOf(highlight);
  const date = highlight.date ?? "";
  const week = activity.weeks.find(
    ({ start }) =>
      dayNumber(start) <= dayNumber(date) &&
      dayNumber(date) < dayNumber(start) + DAYS_PER_WEEK * MS_PER_DAY,
  );
  const rest = (week?.commits ?? 0) - commits;
  return {
    big: formatCount(commits),
    unit: noun(commits, "commit", "commits"),
    viz:
      rest >= 0 && week !== undefined
        ? { kind: "share", part: commits, rest }
        : null,
    evidence:
      week === undefined
        ? date
        : `${date} · ${formatCount(week.commits)} commits that week`,
  };
};

const nightOwls: Build = (highlight, { punchcard }) => ({
  big: formatPercent(valueOf(highlight)),
  unit: "after dark",
  viz: barsViz(hourTotals(punchcard), isNightHour),
  evidence: "commits by hour, night hours highlighted",
});

const weekend: Build = (highlight, { punchcard }) => ({
  big: formatPercent(valueOf(highlight)),
  unit: "on weekends",
  viz: barsViz(weekdayTotals(punchcard), isWeekend),
  evidence: "commits by weekday, Saturday and Sunday highlighted",
});

const newcomers: Build = (highlight, { thresholds }) => {
  const people = valueOf(highlight);
  return {
    big: formatCount(people),
    unit: noun(people, "new face", "new faces"),
    viz: peopleViz(highlight, people),
    evidence: `first commit in the last ${thresholds.badges.welcomeDays} days`,
  };
};

const quietArea: Build = (highlight) => ({
  big: formatCount(Math.floor(valueOf(highlight))),
  unit: "months untouched",
  viz: { kind: "path", text: highlight.path ?? "" },
  evidence: `last commit touching ${highlight.path ?? ""} on ${highlight.date ?? ""}`,
});

const renameRecord: Build = (highlight) => ({
  big: formatCount(valueOf(highlight)),
  unit: "renames",
  viz: { kind: "path", text: highlight.path ?? "" },
  evidence: "the most renamed file, followed through its history",
});

const biggestCleanup: Build = (highlight) => ({
  big: `−${formatCount(valueOf(highlight))}`,
  unit: "net lines",
  viz: { kind: "pill", text: formatDateLong(highlight.date ?? "") },
  evidence: `commit of ${highlight.date ?? ""}, code files only`,
});

const truckFactorAlert: Build = (highlight) => ({
  big: formatCount(valueOf(highlight)),
  unit: "person",
  viz: peopleViz(highlight, 0),
  evidence: "the knowledge of half the files rests on one person",
});

const orphanedKnowledge: Build = (highlight) => ({
  big: formatCount(valueOf(highlight)),
  unit: "files without an active expert",
  viz: { kind: "path", text: highlight.path ?? "" },
  evidence: `the largest orphaned area: ${highlight.path ?? ""}`,
});

const LOOKS: Record<
  Highlight["kind"],
  { icon: IconName; slot: number; build: Build }
> = {
  anniversary: { icon: "cake", slot: 7, build: anniversary },
  streak: { icon: "flame", slot: 2, build: streak },
  "busiest-day": { icon: "zap", slot: 1, build: busiestDay },
  "night-owls": { icon: "moon", slot: 3, build: nightOwls },
  weekend: { icon: "calendar", slot: 1, build: weekend },
  newcomers: { icon: "usersplus", slot: 3, build: newcomers },
  "quiet-area": { icon: "snow", slot: 4, build: quietArea },
  "rename-record": { icon: "shuffle", slot: 6, build: renameRecord },
  "biggest-cleanup": { icon: "trash", slot: 5, build: biggestCleanup },
  "truck-factor-alert": { icon: "truck", slot: 4, build: truckFactorAlert },
  "orphaned-knowledge": { icon: "ghost", slot: 5, build: orphanedKnowledge },
};

/** The cards of the highlights strip, in the report's order; none when the report has no highlight. */
export const highlightCards = (report: Report): HighlightCard[] =>
  report.highlights.map((highlight) => {
    const { icon, slot, build } = LOOKS[highlight.kind];
    return {
      kind: highlight.kind,
      icon,
      slot,
      title: highlight.title,
      text: emphasize(highlight),
      ...build(highlight, report),
    };
  });

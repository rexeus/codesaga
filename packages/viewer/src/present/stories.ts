import type { Report } from "@codesaga/engine";

import { emphasize } from "./emphasis.js";
import {
  formatAge,
  formatCount,
  formatDate,
  formatDateLong,
  formatPercent,
} from "./format.js";
import type { Segment } from "./header.js";
import type { IconName } from "./icons.js";
import { initialsOf, personEntities } from "./people.js";
import {
  hourTotals,
  isNightHour,
  isWeekend,
  nightLabel,
  weekdayTotals,
} from "./rhythm.js";
import { TYPESCRIPT_STORY_LOOKS } from "./typescript-story-looks.js";

type Story = Report["stories"][number];

/** The small picture of a story card. */
export type StoryViz =
  | {
      readonly kind: "timeline";
      /** Where each anniversary lies on the line from the first commit (0) to today (1). */
      readonly anniversaries: readonly number[];
    }
  | { readonly kind: "dots"; readonly count: number }
  | { readonly kind: "share"; readonly part: number; readonly rest: number }
  | {
      readonly kind: "people";
      readonly people: readonly { initials: string; entity: string }[];
      readonly more: number;
    }
  | {
      readonly kind: "bars";
      /** Each bar's height, 0 to 1, and whether it is the highlighted part. */
      readonly bars: readonly { height: number; on: boolean }[];
    }
  | { readonly kind: "path"; readonly text: string }
  | { readonly kind: "pill"; readonly text: string };

/** One story, ready to draw: icon and accent slot, the big figure, a sentence, a picture and its evidence. */
export type StoryCard = {
  readonly kind: Story["kind"];
  readonly icon: IconName;
  /** The categorical slot (1 to 7) the card is tinted with. */
  readonly slot: number;
  readonly title: string;
  readonly big: string;
  readonly unit: string;
  readonly text: readonly Segment[];
  readonly viz: StoryViz | null;
  readonly evidence: string;
};

type Parts = Pick<StoryCard, "big" | "unit" | "viz" | "evidence">;
type Build = (story: Story, report: Report) => Parts;

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365;
const DAYS_PER_WEEK = 7;
const MAX_DOTS = 36;
const MIN_BAR = 0.08;

const valueOf = ({ value }: Story): number => value ?? 0;

const dayNumber = (iso: string): number =>
  Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

const addDays = (iso: string, days: number): string =>
  new Date(dayNumber(iso) + days * MS_PER_DAY).toISOString().slice(0, 10);

const noun = (count: number, one: string, many: string): string =>
  count === 1 ? one : many;

const peopleViz = (
  { people = [] }: Story,
  total: number,
  report: Report,
): StoryViz => ({
  kind: "people",
  people: people.map(({ name, email }) => ({
    initials: initialsOf(name),
    entity: personEntities(report.contributors)(email),
  })),
  more: Math.max(0, total - people.length),
});

const barsViz = (
  totals: readonly number[],
  on: (index: number) => boolean,
): StoryViz => {
  const peak = Math.max(1, ...totals);
  return {
    kind: "bars",
    bars: totals.map((total, index) => ({
      height: Math.max(MIN_BAR, total / peak),
      on: on(index),
    })),
  };
};

const anniversary: Build = (story, { repository, generatedAt }) => {
  const since = repository.firstCommitAt ?? generatedAt;
  const days = Math.round(
    (dayNumber(generatedAt) - dayNumber(since)) / MS_PER_DAY,
  );
  const value = valueOf(story);
  const evidence = `first commit ${formatDate(since)} · ${formatCount(days)} days of history`;
  if (story.unit === "days") {
    return {
      big: formatCount(value),
      unit: "days old",
      viz: {
        kind: "timeline",
        anniversaries: [Math.min(1, value / Math.max(1, days))],
      },
      evidence,
    };
  }
  const months = formatAge(since, generatedAt).split(" and ")[1];
  return {
    big: `${value} ${noun(value, "year", "years")}`,
    unit: months === undefined ? "" : `+ ${months}`,
    viz: {
      kind: "timeline",
      anniversaries: Array.from(
        { length: value },
        (_, index) => (DAYS_PER_YEAR * (index + 1)) / Math.max(1, days),
      ),
    },
    evidence,
  };
};

const streak: Build = (story) => {
  const days = valueOf(story);
  const first = story.date ?? "";
  return {
    big: String(days),
    unit: "days in a row",
    viz: { kind: "dots", count: Math.min(days, MAX_DOTS) },
    evidence: `${first} to ${addDays(first, days - 1)}`,
  };
};

/** The share of the busiest day in the commits of its week, when the week is in the window. */
const busiestDay: Build = (story, { activity }) => {
  const commits = valueOf(story);
  const date = story.date ?? "";
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

const nightOwls: Build = (story, { punchcard, thresholds }) => ({
  big: formatPercent(valueOf(story)),
  unit: "after dark",
  viz: barsViz(hourTotals(punchcard), isNightHour(thresholds.stories)),
  evidence: `commits by hour, ${nightLabel(thresholds.stories)} highlighted`,
});

const weekend: Build = (story, { punchcard }) => ({
  big: formatPercent(valueOf(story)),
  unit: "on weekends",
  viz: barsViz(weekdayTotals(punchcard), isWeekend),
  evidence: "commits by weekday, weekend highlighted",
});

const newcomers: Build = (story, report) => {
  const people = valueOf(story);
  return {
    big: formatCount(people),
    unit: noun(people, "new face", "new faces"),
    viz: peopleViz(story, people, report),
    evidence: `first commit in the last ${report.thresholds.badges.newHereDays} days`,
  };
};

const quietTerritory: Build = (story) => ({
  big: formatCount(Math.floor(valueOf(story))),
  unit: "months untouched",
  viz: { kind: "path", text: story.path ?? "" },
  evidence: `last commit touching ${story.path ?? ""} on ${story.date ?? ""}`,
});

const renameRecord: Build = (story) => ({
  big: formatCount(valueOf(story)),
  unit: "renames",
  viz: { kind: "path", text: story.path ?? "" },
  evidence: "the most renamed file, followed through its history",
});

const biggestCleanup: Build = (story) => ({
  big: `−${formatCount(valueOf(story))}`,
  unit: "net lines",
  viz: { kind: "pill", text: formatDateLong(story.date ?? "") },
  evidence: `commit of ${story.date ?? ""}, code files only`,
});

const truckFactorAlert: Build = (story, report) => ({
  big: formatCount(valueOf(story)),
  unit: "person",
  viz: peopleViz(story, 0, report),
  evidence: "the knowledge of half the files rests on one person",
});

const orphanedKnowledge: Build = (story) => ({
  big: formatCount(valueOf(story)),
  unit: "files without an active expert",
  viz: { kind: "path", text: story.path ?? "" },
  evidence: `the largest orphaned territory: ${story.path ?? ""}`,
});

const LOOKS: Record<
  Story["kind"],
  { icon: IconName; slot: number; build: Build }
> = {
  anniversary: { icon: "cake", slot: 7, build: anniversary },
  streak: { icon: "flame", slot: 2, build: streak },
  "busiest-day": { icon: "zap", slot: 1, build: busiestDay },
  "night-owls": { icon: "moon", slot: 3, build: nightOwls },
  weekend: { icon: "calendar", slot: 1, build: weekend },
  newcomers: { icon: "user-plus", slot: 3, build: newcomers },
  "quiet-territory": { icon: "snowflake", slot: 4, build: quietTerritory },
  "rename-record": { icon: "shuffle", slot: 6, build: renameRecord },
  "biggest-cleanup": { icon: "trash-2", slot: 5, build: biggestCleanup },
  "truck-factor-alert": { icon: "truck", slot: 4, build: truckFactorAlert },
  "orphaned-knowledge": { icon: "ghost", slot: 5, build: orphanedKnowledge },
  ...TYPESCRIPT_STORY_LOOKS,
};

/** The cards of the stories strip, in the report's order; none when the report has no story. */
export const storyCards = (report: Report): StoryCard[] =>
  report.stories.map((story) => {
    const { icon, slot, build } = LOOKS[story.kind];
    return {
      kind: story.kind,
      icon,
      slot,
      title: story.title,
      text: emphasize(story),
      ...build(story, report),
    };
  });

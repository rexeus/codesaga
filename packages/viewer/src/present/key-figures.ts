import type { Report } from "@codesaga/engine";

import {
  formatCount,
  formatSignedCount,
  formatSignedPercent,
} from "./format.js";
import { languageShares } from "./languages.js";
import type { LanguageShare } from "./languages.js";
import { initialsOf, slotOf } from "./people.js";

/** A short history drawn as a sparkline; the last `recent` values are emphasised. */
export type Trend = {
  readonly values: readonly number[];
  readonly recent: number;
};

/** What a key-figure card shows under its figure. */
export type Foot =
  | {
      readonly kind: "delta";
      readonly text: string;
      readonly direction: "up" | "down" | "flat";
      readonly against: string;
    }
  | { readonly kind: "caption"; readonly text: string }
  | {
      readonly kind: "person";
      readonly name: string;
      readonly initials: string;
      readonly slot: number;
      readonly detail: string;
    }
  | { readonly kind: "languages"; readonly shares: readonly LanguageShare[] }
  | {
      readonly kind: "people";
      readonly count: number;
      readonly caption: string;
      readonly solo: boolean;
    };

/** One headline card: a label, the figure with its unit, a history and a foot. */
export type KeyFigure = {
  readonly label: string;
  readonly value: string;
  readonly unit: string | null;
  readonly trend: Trend | null;
  readonly foot: Foot;
};

type Weeks = Report["activity"]["weeks"];
type Comparison = NonNullable<Report["comparison"]>;

const RECENT_WEEKS = 12;
const RECENT_MONTHS = 3;
const MIN_WEEKS_FOR_DELTA = 2 * RECENT_WEEKS + 2;
const MAX_TRUCK_DOTS = 20;
const TENS = 10;
const MS_PER_DAY = 86_400_000;

const direction = (change: number): "up" | "down" | "flat" => {
  if (change === 0) {
    return "flat";
  }
  return change > 0 ? "up" : "down";
};

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** A relative change, or the count itself when the previous period had nothing to relate to. */
const comparisonDelta = ({ delta }: Comparison): Foot => ({
  kind: "delta",
  text:
    delta.commits.ratio === null
      ? formatSignedCount(delta.commits.change)
      : formatSignedPercent(delta.commits.ratio),
  direction: direction(delta.commits.change),
  against: "vs previous period",
});

const recentDelta = (weeks: Weeks): Foot | null => {
  if (weeks.length < MIN_WEEKS_FOR_DELTA) {
    return null;
  }
  const commits = weeks.map((week) => week.commits);
  const recent = sum(commits.slice(-RECENT_WEEKS));
  const previous = sum(commits.slice(-2 * RECENT_WEEKS, -RECENT_WEEKS));
  if (previous === 0) {
    return null;
  }
  const ratio = (recent - previous) / previous;
  return {
    kind: "delta",
    text: formatSignedPercent(ratio),
    direction: direction(recent - previous),
    against: `vs previous ${RECENT_WEEKS} weeks`,
  };
};

/** Whole commits per week from ten on, one decimal below: "about 280", "about 4.5". */
const perWeek = (commits: number, weeks: Weeks): Foot => {
  const pace = commits / Math.max(1, weeks.length);
  const rounded = pace >= TENS ? Math.round(pace) : Math.round(pace * 10) / 10;
  return { kind: "caption", text: `about ${formatCount(rounded)} per week` };
};

const commitsFigure = ({
  overview,
  activity,
  comparison,
}: Report): KeyFigure => ({
  label: "Commits",
  value: formatCount(overview.commits),
  unit: null,
  trend: {
    values: activity.weeks.map(({ commits }) => commits),
    recent: RECENT_WEEKS,
  },
  foot:
    (comparison === undefined ? null : comparisonDelta(comparison)) ??
    recentDelta(activity.weeks) ??
    perWeek(overview.commits, activity.weeks),
});

/** The only author of a solo repository, with how often they committed over the repository's life. */
const soloFoot = ({ contributors, repository, generatedAt }: Report): Foot => {
  const [author] = contributors;
  if (author === undefined || repository.firstCommitAt === null) {
    return { kind: "caption", text: "One author for the whole history" };
  }
  const days = Math.round(
    (Date.parse(generatedAt) - Date.parse(repository.firstCommitAt)) /
      MS_PER_DAY,
  );
  return {
    kind: "person",
    name: author.name,
    initials: initialsOf(author.name),
    slot: slotOf(author.email),
    detail: `${formatCount(author.activeDays)} active days of ${formatCount(days)}`,
  };
};

const contributorsFigure = (report: Report): KeyFigure => {
  const { overview, activity } = report;
  const { total, active90 } = overview.contributors;
  if (total === 1) {
    return {
      label: "Contributors",
      value: "1",
      unit: "solo project",
      trend: null,
      foot: soloFoot(report),
    };
  }
  return {
    label: "Active contributors",
    value: formatCount(active90),
    unit: `of ${formatCount(total)} all-time`,
    trend: {
      values: activity.months.map(({ contributors }) => contributors),
      recent: RECENT_MONTHS,
    },
    foot: { kind: "caption", text: "Active in the last 90 days · per month" },
  };
};

/**
 * The running net lines of the window, week by week. A sparkline is scaled to
 * its own range, so the shape is the growth of the code however many lines it
 * started with. Null for fewer than two weeks.
 */
const locTrend = ({ activity }: Report): Trend | null => {
  if (activity.weeks.length < 2) {
    return null;
  }
  let lines = 0;
  return {
    values: activity.weeks.map(
      ({ added, deleted }) => (lines += added - deleted),
    ),
    recent: RECENT_WEEKS,
  };
};

const linesFigure = (report: Report): KeyFigure => ({
  label: "Lines of code",
  value: formatCount(report.overview.loc),
  unit: `in ${formatCount(report.overview.files)} files`,
  trend: locTrend(report),
  foot: {
    kind: "languages",
    shares: languageShares(report.overview.languages),
  },
});

const truckFigure = ({ knowledge, overview }: Report): KeyFigure => {
  const { value } = knowledge.truckFactor;
  return {
    label: "Truck factor",
    value: formatCount(value),
    unit: value === 1 ? "person" : "people",
    trend: null,
    foot: {
      kind: "people",
      count: Math.min(value, MAX_TRUCK_DOTS),
      caption: "must leave before half the files lose every expert",
      solo: overview.contributors.total === 1,
    },
  };
};

/**
 * The four cards under the header: commits, active contributors, lines of
 * code and the truck factor. Every figure comes from one report field, so
 * each can be checked against the embedded JSON.
 */
export const keyFigures = (report: Report): KeyFigure[] => [
  commitsFigure(report),
  contributorsFigure(report),
  linesFigure(report),
  truckFigure(report),
];

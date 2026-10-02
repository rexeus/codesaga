import type { Report } from "@codesaga/engine";

import { formatCount, formatDateLong } from "./format.js";
import type { IconName } from "./icons.js";

type Achievement = Report["achievements"][number];

const LOOKS: Record<Achievement["kind"], { icon: IconName; slot: number }> = {
  "first-commits": { icon: "git-commit-horizontal", slot: 1 },
  marathon: { icon: "footprints", slot: 2 },
  community: { icon: "users-round", slot: 3 },
  "bus-proof": { icon: "bus", slot: 4 },
  polyglot: { icon: "languages", slot: 7 },
  "test-culture": { icon: "flask-conical", slot: 6 },
  unbroken: { icon: "flame", slot: 2 },
  "spring-cleaning": { icon: "brush-cleaning", slot: 5 },
  "fresh-blood": { icon: "sprout", slot: 3 },
};

/** What a tier of a tiered achievement counts, as `Tier 3 of 3 · 100+ contributors` says it. */
const TIER_UNITS: Partial<Record<Achievement["kind"], string>> = {
  "first-commits": "commits",
  community: "contributors",
};

const ISO_DAY = /\d{4}-\d{2}-\d{2}/gu;

/** The progress toward a threshold: a heading, the figures in words and how full the bar is, 0 to 1. */
type Progress = {
  readonly heading: string;
  readonly figures: string;
  readonly fraction: number;
};

/** An achievement as a medallion. */
export type Medal = {
  readonly kind: Achievement["kind"];
  readonly title: string;
  readonly icon: IconName;
  /** The entity class that carries the medallion's color. */
  readonly tint: string;
  readonly reached: boolean;
  /** Reached with nothing left above it; such a medallion carries a check. */
  readonly complete: boolean;
  /** The tier pips and their caption, for a tiered achievement that has reached a tier. */
  readonly tiers: {
    readonly total: number;
    readonly reached: number;
    readonly caption: string;
  } | null;
  readonly detail: string;
  /** The chip of a reached achievement: the day it was reached, or that it holds today. */
  readonly when: { readonly icon: IconName; readonly text: string } | null;
  readonly progress: Progress | null;
};

const tiersOf = ({ kind, tier, tiers }: Achievement): Medal["tiers"] => {
  if (tier === undefined || tiers === undefined || tiers.length < 2) {
    return null;
  }
  const threshold = formatCount(tiers[tier - 1] ?? 0);
  const unit = TIER_UNITS[kind];
  return {
    total: tiers.length,
    reached: tier,
    caption: `Tier ${tier} of ${tiers.length} · ${threshold}+${unit === undefined ? "" : ` ${unit}`}`,
  };
};

const whenOf = ({ reachedAt, holds }: Achievement): Medal["when"] => {
  if (reachedAt !== null) {
    return {
      icon: "calendar-check",
      text: `Reached ${formatDateLong(reachedAt)}`,
    };
  }
  return { icon: "check", text: holds === "state" ? "Holds today" : "Reached" };
};

const progressOf = ({ reached, progress }: Achievement): Progress | null => {
  if (progress === null) {
    return null;
  }
  const { value, target, unit } = progress;
  return {
    heading: reached ? `Next: ${formatCount(target)} ${unit}` : "Not yet",
    figures: reached
      ? `${formatCount(value)} / ${formatCount(target)}`
      : `${formatCount(value)} / ${formatCount(target)} ${unit}`,
    fraction: target === 0 ? 1 : Math.min(1, value / target),
  };
};

const medalOf = (achievement: Achievement): Medal => {
  const { kind, title, reached, progress, detail } = achievement;
  return {
    kind,
    title,
    icon: LOOKS[kind].icon,
    tint: `slot-${LOOKS[kind].slot}`,
    reached,
    complete: reached && progress === null,
    tiers: tiersOf(achievement),
    detail: detail.replaceAll(ISO_DAY, (day) => formatDateLong(day)),
    when: reached ? whenOf(achievement) : null,
    progress: progressOf(achievement),
  };
};

/** The achievements as medallions, the reached ones first and each group in the report's order. */
export const medals = (achievements: readonly Achievement[]): Medal[] =>
  [
    ...achievements.filter(({ reached }) => reached),
    ...achievements.filter(({ reached }) => !reached),
  ].map((achievement) => medalOf(achievement));

/** The line above the medallions: `5 of 9` in strong type, then `reached · 4 still ahead`. */
export const achievementSummary = (
  achievements: readonly Achievement[],
): { readonly strong: string; readonly rest: string } => {
  const reached = achievements.filter(
    (achievement) => achievement.reached,
  ).length;
  const ahead = achievements.length - reached;
  return {
    strong: `${reached} of ${achievements.length}`,
    rest: ahead === 0 ? " reached" : ` reached · ${ahead} still ahead`,
  };
};

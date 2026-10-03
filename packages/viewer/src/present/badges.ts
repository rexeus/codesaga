import type { Report } from "@codesaga/engine";

import type { IconName } from "./icons.js";

type TerritoryBadge =
  Report["knowledge"]["territories"]["territories"][number]["badges"][number];
type ContributorBadge = Report["contributors"][number]["badges"][number];

/**
 * How a badge is tinted. A badge wears the color of its category, except the
 * four territory badges that name a risk, which keep a warning color: `crit`
 * for orphaned knowledge, `warn` for an island, for fading knowledge and for a
 * territory in a cycle. A person's badge never wears a warning color.
 */
type Tone =
  | TerritoryBadge["category"]
  | ContributorBadge["category"]
  | "crit"
  | "warn";

/** A badge ready to draw: its glyph and tint, its label, and the rule and numbers behind it for a tooltip. */
export type BadgeChip = {
  readonly icon: IconName;
  readonly tone: Tone;
  readonly label: string;
  readonly evidence: string;
};

/** The badges of one card: the first few, and what the rest add up to. */
export type BadgeRow = {
  readonly chips: readonly BadgeChip[];
  /** The badges that did not fit, as a "+n" chip whose tooltip names them; null when all fit. */
  readonly more: { readonly count: number; readonly labels: string } | null;
  /** Every badge, for the places that have room to spell each one out. */
  readonly all: readonly BadgeChip[];
};

/** At most this many badges are drawn on a card. */
const MAX_BADGES = 3;

const TERRITORY_ICONS: Record<TerritoryBadge["kind"], IconName> = {
  island: "tree-palm",
  orphaned: "ghost",
  "one-expert": "user",
  "shared-knowledge": "users",
  "knowledge-fading": "hourglass",
  handover: "arrow-right-left",
  "newcomer-friendly": "user-plus",
  "new-territory": "sprout",
  "in-focus": "crosshair",
  quiet: "snowflake",
  heavyweight: "weight",
  hotspot: "flame",
  churning: "refresh-cw",
  "deeply-nested": "indent-increase",
  "well-tested": "shield-check",
  "type-safe": "shield-half",
  strict: "lock",
  "complex-logic": "waypoints",
  "in-a-cycle": "repeat-2",
};

const RISK_TONES: Partial<Record<TerritoryBadge["kind"], "crit" | "warn">> = {
  orphaned: "crit",
  island: "warn",
  "knowledge-fading": "warn",
  "in-a-cycle": "warn",
};

const CONTRIBUTOR_ICONS: Record<ContributorBadge["kind"], IconName> = {
  "all-rounder": "layers",
  specialist: "target",
  keeper: "key-round",
  tidier: "trash-2",
  tester: "shield-check",
  documenter: "book-open",
  "night-owl": "moon",
  "early-bird": "sunrise",
  "weekend-regular": "calendar-days",
  "pair-partner": "users",
  "long-hauler": "mountain",
  explorer: "compass",
  toolsmith: "wrench",
  "type-tightener": "shrink",
  sweeper: "brush-cleaning",
  simplifier: "minimize-2",
  "test-companion": "flask-conical",
  reviewer: "eye",
  founder: "flag",
  steady: "calendar",
  "new-here": "sparkles",
  "back-again": "repeat",
};

const rowOf = (chips: readonly BadgeChip[]): BadgeRow => {
  const rest = chips.slice(MAX_BADGES);
  return {
    chips: chips.slice(0, MAX_BADGES),
    more:
      rest.length === 0
        ? null
        : {
            count: rest.length,
            labels: rest.map(({ label }) => label).join(", "),
          },
    all: chips,
  };
};

/**
 * The first three badges of a territory, in the order the engine ranked them
 * (most important first), and a count of the others.
 */
export const territoryBadges = (badges: readonly TerritoryBadge[]): BadgeRow =>
  rowOf(
    badges.map(({ kind, category, label, evidence }) => ({
      icon: TERRITORY_ICONS[kind],
      tone: RISK_TONES[kind] ?? category,
      label,
      evidence,
    })),
  );

/** The first three badges of a contributor, in the order the engine ranked them, and a count of the others. */
export const contributorBadges = (
  badges: readonly ContributorBadge[],
): BadgeRow =>
  rowOf(
    badges.map(({ kind, category, label, evidence }) => ({
      icon: CONTRIBUTOR_ICONS[kind],
      tone: category,
      label,
      evidence,
    })),
  );

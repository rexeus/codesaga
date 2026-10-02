import type { Report } from "@codesaga/engine";

import type { IconName } from "./icons.js";

type AreaBadge =
  Report["knowledge"]["areas"]["levels"][number]["areas"][number]["badges"][number];
type ContributorBadge = Report["contributors"][number]["badges"][number];

/** How a badge is tinted: a warning, something good, plain news, or nothing special. */
type Tone = "crit" | "warn" | "good" | "info" | "plain";

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
};

/** At most this many badges are drawn on a card. */
const MAX_BADGES = 3;

const AREA_LOOKS: Record<AreaBadge["kind"], { icon: IconName; tone: Tone }> = {
  island: { icon: "island", tone: "warn" },
  orphaned: { icon: "ghost", tone: "crit" },
  "single-expert": { icon: "user", tone: "warn" },
  "shared-knowledge": { icon: "users", tone: "good" },
  "knowledge-fading": { icon: "hourglass", tone: "warn" },
  handover: { icon: "repeat", tone: "info" },
  new: { icon: "spark", tone: "info" },
  "in-focus": { icon: "target", tone: "info" },
  quiet: { icon: "snow", tone: "plain" },
  "newcomer-friendly": { icon: "usersplus", tone: "good" },
  "well-tested": { icon: "check", tone: "good" },
};

const CONTRIBUTOR_LOOKS: Record<
  ContributorBadge["kind"],
  { icon: IconName; tone: Tone }
> = {
  "all-rounder": { icon: "layers", tone: "plain" },
  specialist: { icon: "target", tone: "plain" },
  cleaner: { icon: "trash", tone: "plain" },
  founder: { icon: "flag", tone: "plain" },
  keeper: { icon: "key", tone: "plain" },
  tester: { icon: "check", tone: "plain" },
  documenter: { icon: "book", tone: "plain" },
  steady: { icon: "calendar", tone: "plain" },
  welcome: { icon: "spark", tone: "info" },
  returning: { icon: "repeat", tone: "info" },
  reviewer: { icon: "eye", tone: "plain" },
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
  };
};

/**
 * The first three badges of an area, in the order the engine ranked them
 * (most important first), and a count of the others.
 */
export const areaBadges = (badges: readonly AreaBadge[]): BadgeRow =>
  rowOf(
    badges.map(({ kind, label, evidence }) => ({
      ...AREA_LOOKS[kind],
      label,
      evidence,
    })),
  );

/** The first three badges of a contributor, in the order the engine ranked them, and a count of the others. */
export const contributorBadges = (
  badges: readonly ContributorBadge[],
): BadgeRow =>
  rowOf(
    badges.map(({ kind, label, evidence }) => ({
      ...CONTRIBUTOR_LOOKS[kind],
      label,
      evidence,
    })),
  );

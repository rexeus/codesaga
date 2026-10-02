import type { BadgeChip, BadgeRow } from "../present/badges.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";
import { bindTooltip } from "./tooltip.js";

const chip = ({
  icon: name,
  tone,
  label,
  evidence,
}: BadgeChip): HTMLElement => {
  const element = h("span", `pill badge tone-${tone}`, icon(name, 13), label);
  element.tabIndex = 0;
  bindTooltip(element, { title: label, rows: [], text: evidence });
  return element;
};

const moreChip = ({
  count,
  labels,
}: NonNullable<BadgeRow["more"]>): HTMLElement => {
  const element = h("span", "pill quiet", `+${count}`);
  element.tabIndex = 0;
  bindTooltip(element, { title: `${count} more`, rows: [], text: labels });
  return element;
};

/**
 * The badges of a card as achievement chips: a glyph, the label, and the rule
 * behind it as a tooltip that the keyboard can reach too. Names and evidence
 * are set as text.
 */
export const badgeChips = ({ chips, more }: BadgeRow): HTMLElement[] => [
  ...chips.map((badge) => chip(badge)),
  ...(more === null ? [] : [moreChip(more)]),
];

/** Every badge with the rule behind it written out beside it, for a place with room. */
export const badgeList = (badges: readonly BadgeChip[]): HTMLElement =>
  h(
    "div",
    "blist",
    ...badges.map((badge) =>
      h(
        "div",
        "brow",
        h(
          "span",
          `pill badge tone-${badge.tone}`,
          icon(badge.icon, 13),
          badge.label,
        ),
        h("span", "ev", badge.evidence),
      ),
    ),
  );

import type { BadgeChip, BadgeRow } from "../present/badges.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";
import { bindTooltip } from "./tooltip.js";

const TONE_CLASS: Record<BadgeChip["tone"], string> = {
  crit: " crit",
  warn: " warn",
  good: " good",
  info: " info",
  plain: "",
};

const chip = ({
  icon: name,
  tone,
  label,
  evidence,
}: BadgeChip): HTMLElement => {
  const element = h(
    "span",
    `pill badge${TONE_CLASS[tone]}`,
    icon(name, 13),
    label,
  );
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

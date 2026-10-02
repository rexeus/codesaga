import { formatCount } from "../present/format.js";
import type { TerritoryView } from "../present/territories.js";
import { splitsAt } from "../present/territory-tree.js";
import { badgeChips } from "./badges.js";
import { h } from "./dom.js";
import { expertBar, expertRows, lineOwners } from "./territory-experts.js";
import {
  focusable,
  insideLine,
  kindChip,
  metaLine,
  pathTitle,
  toggleButton,
  truckPill,
} from "./territory-parts.js";
import type { TreeControls } from "./territory-parts.js";

const EXPERTS_SHOWN = 3;

const topRow = (view: TerritoryView, solo: boolean): HTMLElement =>
  h(
    "div",
    "top",
    h("div", "pathrow", kindChip(view), pathTitle(view)),
    ...(solo || view.other ? [] : [truckPill(view)]),
  );

const footerNote = (
  view: TerritoryView,
  { detail }: TreeControls,
): HTMLElement => {
  if (view.other) {
    return h(
      "span",
      "muted small",
      "Files too few to be a territory of their own",
    );
  }
  return (
    (splitsAt(view.node, detail) ? insideLine(view) : null) ??
    h("span", "muted small", "No split at this detail")
  );
};

/** The footer of a collapsed card: what is inside it at this detail, and the button that opens it. */
const footer = (view: TerritoryView, controls: TreeControls): HTMLElement =>
  h(
    "div",
    "tfoot",
    footerNote(view, controls),
    toggleButton({
      label: "Expand",
      expanded: false,
      onClick: () => {
        controls.toggleOpen(view.key);
      },
      focus: `open:${view.key}`,
    }),
  );

const badgeRow = (view: TerritoryView): HTMLElement[] => {
  const footerChips = [
    ...badgeChips(view.badges),
    ...(view.moreExperts === 0
      ? []
      : [
          h(
            "span",
            "pill quiet",
            `+${view.moreExperts} more ${view.moreExperts === 1 ? "person" : "people"}`,
          ),
        ]),
  ];
  return footerChips.length === 0 ? [] : [h("div", "badges", ...footerChips)];
};

/** A collapsed territory card: its experts as a stacked bar and rows, its truck factor, badges and what is inside it. */
export const territoryCard = (
  view: TerritoryView,
  controls: TreeControls,
): HTMLElement => {
  const element = h(
    "article",
    "card territory",
    topRow(view, false),
    metaLine(view),
    expertBar(view),
    expertRows(view, EXPERTS_SHOWN),
    ...lineOwners(view),
    ...badgeRow(view),
    footer(view, controls),
  );
  element.tabIndex = -1;
  return focusable(element, `node:${view.key}`);
};

/** A solo repository's collapsed card: its lines as a number and a bar against the biggest territory, since every expert is the same person. */
export const soloTerritoryCard = (
  view: TerritoryView,
  controls: TreeControls,
): HTMLElement => {
  const fill = h("i", "");
  fill.style.width = `${Math.max(3, view.sizeFraction * 100)}%`;
  const chips = badgeChips(view.badges);
  const element = h(
    "article",
    "card territory",
    topRow(view, true),
    metaLine(view),
    h(
      "div",
      "size",
      formatCount(view.node.stats.codeLines),
      h("small", "", " lines"),
    ),
    h("div", "sizebar", fill),
    ...(chips.length === 0 ? [] : [h("div", "badges", ...chips)]),
    footer(view, controls),
  );
  element.tabIndex = -1;
  return focusable(element, `node:${view.key}`);
};

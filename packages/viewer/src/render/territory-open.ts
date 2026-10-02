import { territoryViews } from "../present/territories.js";
import type { TerritoryView } from "../present/territories.js";
import { territoryStats } from "../present/territory-stats.js";
import { splitReasonLine, splitsAt } from "../present/territory-tree.js";
import { territoryTypeScript } from "../present/typescript-territory.js";
import { badgeChips, badgeList } from "./badges.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";
import { expertBar, expertRows, ownerLine } from "./territory-experts.js";
import {
  focusable,
  kindChip,
  metaLine,
  pathTitle,
  toggleButton,
  truckPill,
} from "./territory-parts.js";
import type { TreeControls } from "./territory-parts.js";
import { statsPanel } from "./territory-stats-view.js";
import { typescriptItem } from "./territory-typescript-view.js";

const EXPERTS_SHOWN = 4;

const present = (parts: readonly (HTMLElement | null)[]): HTMLElement[] =>
  parts.filter((part) => part !== null);

const statsOf = (
  { node }: TerritoryView,
  { report, languageEntity }: TreeControls,
): HTMLElement => {
  const typescript = territoryTypeScript(node, report.deepDives?.typescript);
  return statsPanel(
    territoryStats(node.stats, report.stats, languageEntity),
    typescript === null ? null : typescriptItem(typescript),
  );
};

const truck = (
  view: TerritoryView,
  { solo }: TreeControls,
): HTMLElement | null => (solo || view.other ? null : truckPill(view));

const title = (text: string): HTMLElement => h("div", "ptitle", text);

const pane = (...content: readonly (HTMLElement | null)[]): HTMLElement =>
  h("div", "pane", ...present(content));

/** The line that sends the reader to the detail at which a territory splits. */
const showLater = (
  view: TerritoryView,
  controls: TreeControls,
  line: string,
): HTMLElement | null => {
  const { splitDetail } = view.node;
  if (splitDetail === undefined) {
    return null;
  }
  const show = h("button", "linkbtn", "Show");
  show.type = "button";
  show.addEventListener("click", () => {
    controls.showDetail(splitDetail, `node:${view.key}`);
  });
  return h("div", "later", icon("split", 13, 2), line, show);
};

const sizeBar = ({ sizeFraction }: TerritoryView): HTMLElement => {
  const fill = h("i", "");
  fill.style.width = `${Math.max(4, sizeFraction * 100)}%`;
  return h("div", "sizebar", fill);
};

const badgeRow = (view: TerritoryView): HTMLElement | null => {
  const chips = badgeChips(view.badges);
  return chips.length === 0 ? null : h("div", "badges", ...chips);
};

const subHead = (view: TerritoryView, controls: TreeControls): HTMLElement =>
  h(
    "div",
    "sub-top",
    kindChip(view),
    pathTitle(view),
    h("span", "sp"),
    ...present([truck(view, controls)]),
    toggleButton({
      label: "Stats",
      expanded: controls.isStatsOpen(view.key),
      onClick: () => {
        controls.toggleStats(view.key);
      },
      focus: `stats:${view.key}`,
      glyph: "chart-column",
    }),
  );

/** The reason a territory splits and a small card for each territory inside it. */
const childList = (view: TerritoryView, controls: TreeControls): HTMLElement =>
  h(
    "div",
    "nest",
    h(
      "div",
      "reason",
      icon("split", 14, 2),
      splitReasonLine(view.node.splitReason ?? ""),
    ),
    h(
      "div",
      "subs",
      ...territoryViews(view.node.territories, controls.report).map((child) =>
        subTerritory(child, controls),
      ),
    ),
  );

/** The small card of a territory inside another: its experts, badges, optional stats and the territories inside it. */
const subTerritory = (
  view: TerritoryView,
  controls: TreeControls,
): HTMLElement => {
  const open = splitsAt(view.node, controls.detail);
  const element = h(
    "div",
    `tsub${view.other ? " other" : ""}`,
    subHead(view, controls),
    metaLine(view),
    ...(controls.solo
      ? [sizeBar(view)]
      : [expertBar(view, true), ownerLine(view)]),
    ...present([
      badgeRow(view),
      controls.isStatsOpen(view.key) ? statsOf(view, controls) : null,
      view.inside !== null && !open
        ? showLater(
            view,
            controls,
            `Splits further at Detail ${view.node.splitDetail ?? ""}`,
          )
        : null,
      open ? childList(view, controls) : null,
    ]),
  );
  element.tabIndex = -1;
  return focusable(element, `node:${view.key}`);
};

const whoKnows = (
  view: TerritoryView,
  { solo }: TreeControls,
): HTMLElement[] =>
  solo
    ? []
    : [title("Who knows it"), expertBar(view), expertRows(view, EXPERTS_SHOWN)];

const badgesPane = (view: TerritoryView): HTMLElement[] => [
  title("Badges"),
  view.badges.all.length === 0
    ? h("p", "muted small", "No badges for this territory.")
    : badgeList(view.badges.all),
];

/** What an opened card says where its territories inside are not open at this detail. */
const notSplitNote = (
  view: TerritoryView,
  controls: TreeControls,
): HTMLElement | null =>
  view.inside === null
    ? h(
        "p",
        "muted small flat",
        icon("info", 13, 2),
        "This territory does not split into smaller ones.",
      )
    : showLater(
        view,
        controls,
        `Splits at Detail ${view.node.splitDetail ?? ""}: ${view.node.splitReason ?? ""}`,
      );

/** The body of an opened card: who knows it and its badges beside the territories inside it, or beside the note on why there are none yet. */
const body = (view: TerritoryView, controls: TreeControls): HTMLElement => {
  const who = whoKnows(view, controls);
  if (splitsAt(view.node, controls.detail)) {
    return h(
      "div",
      "body",
      pane(...who, ...badgesPane(view)),
      pane(title("Territories inside"), childList(view, controls)),
    );
  }
  const badges = pane(...badgesPane(view), notSplitNote(view, controls));
  return who.length === 0
    ? h("div", "body one", badges)
    : h("div", "body two", pane(...who), badges);
};

/**
 * A territory card opened to its full width: the stats band, who knows it, its
 * badges with their evidence, and, where its split is open at the current
 * detail, the territories inside it, each a small card that opens its own stats.
 */
export const openTerritory = (
  view: TerritoryView,
  controls: TreeControls,
): HTMLElement => {
  const element = h(
    "article",
    "card territory open",
    h(
      "div",
      "top",
      h("div", "pathrow", kindChip(view), pathTitle(view)),
      h(
        "div",
        "right",
        ...present([truck(view, controls)]),
        toggleButton({
          label: "Collapse",
          expanded: true,
          onClick: () => {
            controls.toggleOpen(view.key);
          },
          focus: `open:${view.key}`,
        }),
      ),
    ),
    metaLine(view),
    h("div", "statsband", title("Stats"), statsOf(view, controls)),
    body(view, controls),
  );
  element.tabIndex = -1;
  return focusable(element, `node:${view.key}`);
};

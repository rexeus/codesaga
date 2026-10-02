import type { Report } from "@codesaga/engine";

import { startDetail } from "../present/detail-slider.js";
import { detailSummary } from "../present/detail-summary.js";
import { languageEntities } from "../present/languages.js";
import { showAllLabel, visibleRows } from "../present/row-limit.js";
import {
  TERRITORY_CARDS_SHOWN,
  territoryViews,
  isSolo,
} from "../present/territories.js";
import type { TerritoryView } from "../present/territories.js";
import { territoryDetails } from "../present/territory-details.js";
import { territoryKey, toggled } from "../present/territory-tree.js";
import { detailSlider } from "./detail-slider.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";
import { summaryLine } from "./knowledge-summary.js";
import type { TreeActions } from "./knowledge-summary.js";
import { section } from "./section.js";
import { territoryCard, soloTerritoryCard } from "./territory-card.js";
import { openTerritory } from "./territory-open.js";
import type { TreeControls } from "./territory-parts.js";

const DESCRIPTION =
  "Territories split the code without overlap. Bars show how many files each person is an expert on; expertise is an estimate from history. Open a territory for its stats and the territories inside it.";

const soloBanner = ({ contributors }: Report): HTMLElement => {
  const name = contributors[0]?.name;
  return h(
    "div",
    "banner",
    icon("info", 22),
    h(
      "p",
      "",
      h("b", "", "Solo repository. "),
      `${name ?? "One person"} is the only contributor, so every territory has exactly one expert. Truck factor and island badges would be noise here; territories show their size and code badges.`,
    ),
  );
};

/** Hands the keyboard focus to the control `id` names, or to the card it belonged to when that control is gone. */
const refocus = (root: HTMLElement, id: string): void => {
  const controls = [...root.querySelectorAll<HTMLElement>("[data-focus]")];
  const target =
    controls.find((control) => control.dataset["focus"] === id) ??
    controls.find(
      (control) =>
        control.dataset["focus"] === id.replace(/^[a-z]+:/u, "node:"),
    );
  target?.focus();
};

/** What the reader has opened: the detail the slider is on, the cards and territories with their stats open, and whether every first-cut card is shown. */
type State = {
  readonly detail: number;
  readonly open: ReadonlySet<string>;
  readonly statsOpen: ReadonlySet<string>;
  readonly showEvery: boolean;
};

const CARD_LIMIT = { rows: TERRITORY_CARDS_SHOWN, noun: "territories" };

/** The elements of the section that a redraw replaces. */
type Parts = {
  readonly summary: HTMLElement;
  readonly grid: HTMLElement;
  readonly more: HTMLElement;
  readonly showAll: HTMLElement;
  readonly notes: HTMLElement;
};

const cardOf = (
  view: TerritoryView,
  controls: TreeControls,
  open: boolean,
): HTMLElement => {
  if (open) {
    return openTerritory(view, controls);
  }
  return controls.solo
    ? soloTerritoryCard(view, controls)
    : territoryCard(view, controls);
};

/** Redraws the summary, the cards and what sits under them for `state`. */
const draw = (
  parts: Parts,
  state: State,
  controls: TreeControls,
  actions: TreeActions,
): void => {
  const { report, solo } = controls;
  const { territories: tree } = report.knowledge;
  const detail = territoryDetails(tree).details[state.detail - 1];
  const cards = territoryViews(tree.territories, report);
  const facts =
    detail === undefined ? null : detailSummary(detail, report.knowledge.files);
  parts.summary.replaceChildren(
    ...(facts === null
      ? []
      : [
          summaryLine(facts, report, solo, cards.length === 0 ? null : actions),
        ]),
  );
  parts.grid.className = solo ? "territories solo" : "territories";
  parts.grid.replaceChildren(
    ...visibleRows(cards, CARD_LIMIT, state.showEvery).map((view) =>
      cardOf(view, controls, state.open.has(view.key)),
    ),
  );
  parts.notes.replaceChildren(
    ...(facts === null || facts.truncated === null
      ? []
      : [h("p", "note", facts.truncated)]),
  );
  parts.more.textContent = state.showEvery
    ? "Show fewer territories"
    : showAllLabel(cards.length, CARD_LIMIT);
  parts.showAll.hidden = cards.length <= TERRITORY_CARDS_SHOWN;
};

type Change = (patch: Partial<State>, focus: string) => void;

const treeControls = (
  report: Report,
  state: State,
  change: Change,
  showDetail: TreeControls["showDetail"],
): TreeControls => ({
  report,
  solo: isSolo(report),
  detail: state.detail,
  isStatsOpen: (key) => state.statsOpen.has(key),
  toggleOpen: (key) => {
    change({ open: toggled(state.open, key) }, `open:${key}`);
  },
  toggleStats: (key) => {
    change({ statsOpen: toggled(state.statsOpen, key) }, `stats:${key}`);
  },
  showDetail,
  languageEntity: languageEntities(report.overview.languages),
});

const treeActions = (report: Report, change: Change): TreeActions => ({
  expandAll: () => {
    const keys = report.knowledge.territories.territories.map((root) =>
      territoryKey(root),
    );
    change({ open: new Set(keys) }, "all:expand");
  },
  collapseAll: () => {
    change({ open: new Set(), statsOpen: new Set() }, "all:collapse");
  },
});

const sectionParts = (): Parts => {
  const more = h("button", "btn");
  more.type = "button";
  return {
    summary: h("div", ""),
    grid: h("div", ""),
    more,
    showAll: h("div", "showall", more),
    notes: h("div", ""),
  };
};

/**
 * The knowledge in non-overlapping territories: a slider over the details the
 * engine computed (starting at the report's detail), a summary of the detail
 * and a card per territory of the first cut, twelve first. A card with
 * territories inside it opens in place, and the slider decides how deep those
 * are open. Redrawing keeps the keyboard focus on the control that was used;
 * no metric is computed here.
 */
export const renderKnowledge = (report: Report): HTMLElement => {
  const territories = territoryDetails(report.knowledge.territories);
  const parts = sectionParts();
  let block: HTMLElement | null = null;
  let pendingFocus: string | undefined;
  let state: State = {
    detail: 1,
    open: new Set(),
    statsOpen: new Set(),
    showEvery: false,
  };

  const showDetail: TreeControls["showDetail"] = (wanted, id) => {
    pendingFocus = id;
    slider.select(wanted - 1);
  };

  const paint = (focus?: string): void => {
    const change: Change = (patch, id) => {
      state = { ...state, ...patch };
      paint(id);
    };
    draw(
      parts,
      state,
      treeControls(report, state, change, showDetail),
      treeActions(report, change),
    );
    if (focus !== undefined && block !== null) {
      refocus(block, focus);
    }
  };

  parts.more.addEventListener("click", () => {
    state = { ...state, showEvery: !state.showEvery };
    paint();
  });

  const slider = detailSlider(
    territories,
    startDetail(territories),
    (index) => {
      state = { ...state, detail: index + 1 };
      const focus = pendingFocus;
      pendingFocus = undefined;
      paint(focus);
    },
  );
  block = section(
    "knowledge",
    "Knowledge",
    "Who knows which territory",
    DESCRIPTION,
    ...(isSolo(report) ? [soloBanner(report)] : []),
    slider.element,
    parts.summary,
    parts.grid,
    parts.showAll,
    parts.notes,
  );
  return block;
};

import type { Report } from "@codesaga/engine";

import { startDetail } from "../present/detail-slider.js";
import { formatCount } from "../present/format.js";
import { showAllLabel, visibleRows } from "../present/row-limit.js";
import {
  TERRITORY_CARDS_SHOWN,
  territoryViews,
  dormantLegend,
  isSolo,
  detailSummary,
} from "../present/territories.js";
import type { DetailSummary } from "../present/territories.js";
import { territoryDetails } from "../present/territory-details.js";
import { detailSlider } from "./detail-slider.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";
import { legend, legendItem, section } from "./section.js";
import { territoryCard, soloTerritoryCard } from "./territory-card.js";

const DESCRIPTION =
  "Territories split the code without overlap. Bars show how many files each person is an expert on; expertise is an estimate from history.";

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
      `${name ?? "One person"} is the only contributor, so every territory has exactly one expert. Truck factor and island flags would be noise here; territories are shown by size instead.`,
    ),
  );
};

const summaryLine = (
  {
    territories,
    otherGroups,
    coveredFiles,
    totalFiles,
    lowTruckFactor,
    islands,
    orphaned,
  }: DetailSummary,
  report: Report,
  solo: boolean,
): HTMLElement => {
  const risks = `${lowTruckFactor} with truck factor 2 or less · ${islands} ${islands === 1 ? "island" : "islands"} · ${orphaned} orphaned`;
  return h(
    "div",
    "ksum",
    h(
      "span",
      "",
      h(
        "b",
        "",
        `${formatCount(territories)} ${territories === 1 ? "territory" : "territories"}`,
      ),
      ...(otherGroups === 0
        ? []
        : [
            ` and ${formatCount(otherGroups)} ${otherGroups === 1 ? "group" : "groups"} of other files,`,
          ]),
      ` covering ${formatCount(coveredFiles)} of ${formatCount(totalFiles)} files`,
    ),
    ...(solo ? [] : [h("span", "", risks)]),
    h("span", "sp"),
    ...(solo
      ? []
      : [
          legend(
            legendItem("slot-1", "Expert on the files"),
            h(
              "li",
              "",
              h("span", "hatchkey"),
              dormantLegend(report.thresholds.activeDays),
            ),
            legendItem("slot-other", "Others"),
          ),
        ]),
  );
};

/**
 * The knowledge in non-overlapping territories: a slider over the details the engine
 * computed (starting at the report's detail), a summary of the detail and a card
 * per territory, twelve first. Switching details redraws the cards from the report;
 * nothing is computed here.
 */
export const renderKnowledge = (report: Report): HTMLElement => {
  const territories = territoryDetails(report.knowledge.territories);
  const solo = isSolo(report);
  const summary = h("div", "");
  const grid = h("div", "");
  const more = h("button", "btn");
  more.type = "button";
  const showAll = h("div", "showall", more);
  const notes = h("div", "");
  let current = startDetail(territories);
  let expanded = false;

  const paint = (): void => {
    const detail = territories.details[current];
    if (detail === undefined) {
      return;
    }
    const facts = detailSummary(detail, report.knowledge.files);
    const limit = { rows: TERRITORY_CARDS_SHOWN, noun: "territories" };
    const cards = territoryViews(detail, report);
    const shown = visibleRows(cards, limit, expanded);
    summary.replaceChildren(summaryLine(facts, report, solo));
    grid.className = solo ? "territories solo" : "territories";
    grid.replaceChildren(
      ...shown.map((view) =>
        solo ? soloTerritoryCard(view) : territoryCard(view),
      ),
    );
    notes.replaceChildren(
      ...(facts.truncated === null ? [] : [h("p", "note", facts.truncated)]),
    );
    more.textContent = expanded
      ? "Show fewer territories"
      : showAllLabel(cards.length, limit);
    showAll.hidden = cards.length <= TERRITORY_CARDS_SHOWN;
  };

  more.addEventListener("click", () => {
    expanded = !expanded;
    paint();
  });

  const slider = detailSlider(territories, current, (index) => {
    current = index;
    expanded = false;
    paint();
  });
  return section(
    "knowledge",
    "Knowledge",
    "Who knows which territory",
    DESCRIPTION,
    ...(solo ? [soloBanner(report)] : []),
    slider,
    summary,
    grid,
    showAll,
    notes,
  );
};

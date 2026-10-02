import type { Report } from "@codesaga/engine";

import {
  AREA_CARDS_SHOWN,
  areaViews,
  inactiveLegend,
  isSolo,
  levelSummary,
  startLevel,
} from "../present/areas.js";
import type { LevelSummary } from "../present/areas.js";
import { formatCount } from "../present/format.js";
import { showAllLabel, visibleRows } from "../present/row-limit.js";
import { areaCard, soloAreaCard } from "./area-card.js";
import { depthSlider } from "./depth-slider.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";
import { legend, legendItem, section } from "./section.js";

const DESCRIPTION =
  "Areas split the code without overlap. Bars show how many files each person is an expert on; expertise is an estimate from history.";

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
      `${name ?? "One person"} is the only contributor, so every area has exactly one expert. Truck factor and island flags would be noise here; areas are shown by size instead.`,
    ),
  );
};

const summaryLine = (
  {
    areas,
    looseGroups,
    coveredFiles,
    totalFiles,
    lowTruckFactor,
    islands,
    orphaned,
  }: LevelSummary,
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
      h("b", "", `${formatCount(areas)} ${areas === 1 ? "area" : "areas"}`),
      ...(looseGroups === 0
        ? []
        : [
            ` and ${formatCount(looseGroups)} ${looseGroups === 1 ? "group" : "groups"} of loose files,`,
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
              inactiveLegend(report.thresholds.activeDays),
            ),
            legendItem("slot-other", "Others"),
          ),
        ]),
  );
};

/**
 * The knowledge in non-overlapping areas: a slider over the levels the engine
 * computed (starting at the report's depth), a summary of the level and a card
 * per area, twelve first. Switching levels redraws the cards from the report;
 * nothing is computed here.
 */
export const renderKnowledge = (report: Report): HTMLElement => {
  const { areas } = report.knowledge;
  const solo = isSolo(report);
  const summary = h("div", "");
  const grid = h("div", "");
  const more = h("button", "btn");
  more.type = "button";
  const showAll = h("div", "showall", more);
  const notes = h("div", "");
  let current = startLevel(areas);
  let expanded = false;

  const paint = (): void => {
    const level = areas.levels[current];
    if (level === undefined) {
      return;
    }
    const facts = levelSummary(level, report.knowledge.files);
    const limit = { rows: AREA_CARDS_SHOWN, noun: "areas" };
    const cards = areaViews(level, report);
    const shown = visibleRows(cards, limit, expanded);
    summary.replaceChildren(summaryLine(facts, report, solo));
    grid.className = solo ? "areas solo" : "areas";
    grid.replaceChildren(
      ...shown.map((view) => (solo ? soloAreaCard(view) : areaCard(view))),
    );
    notes.replaceChildren(
      ...(facts.truncated === null ? [] : [h("p", "note", facts.truncated)]),
    );
    more.textContent = expanded
      ? "Show fewer areas"
      : showAllLabel(cards.length, limit);
    showAll.hidden = cards.length <= AREA_CARDS_SHOWN;
  };

  more.addEventListener("click", () => {
    expanded = !expanded;
    paint();
  });

  const slider = depthSlider(areas, current, (index) => {
    current = index;
    expanded = false;
    paint();
  });
  return section(
    "knowledge",
    "Knowledge",
    "Who knows which part",
    DESCRIPTION,
    ...(solo ? [soloBanner(report)] : []),
    slider,
    summary,
    grid,
    showAll,
    notes,
  );
};

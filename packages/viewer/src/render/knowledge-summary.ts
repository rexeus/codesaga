import type { Report } from "@codesaga/engine";

import { dormantLegend } from "../present/detail-summary.js";
import type { DetailSummary } from "../present/detail-summary.js";
import { formatCount } from "../present/format.js";
import { h } from "./dom.js";
import { legend, legendItem } from "./section.js";
import { focusable } from "./territory-parts.js";

const button = (
  label: string,
  focus: string,
  onClick: () => void,
): HTMLElement => {
  const element = h("button", "mini", label);
  element.type = "button";
  element.addEventListener("click", onClick);
  return focusable(element, focus);
};

const countLine = ({
  territories,
  otherGroups,
  coveredFiles,
  totalFiles,
}: DetailSummary): HTMLElement =>
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
  );

const riskLine = ({
  lowTruckFactor,
  islands,
  orphaned,
}: DetailSummary): HTMLElement =>
  h(
    "span",
    "",
    `${lowTruckFactor} with truck factor 2 or less · ${islands} ${islands === 1 ? "island" : "islands"} · ${orphaned} orphaned`,
  );

/**
 * The key to the cards: who the bar's colors stand for (with a team), what the
 * three badge categories are called and which badges keep a warning color.
 */
const cardLegend = (report: Report, solo: boolean): HTMLElement =>
  legend(
    ...(solo
      ? []
      : [
          legendItem("slot-1", "Expert on the files"),
          h(
            "li",
            "",
            h("span", "hatchkey"),
            dormantLegend(report.thresholds.activeDays),
          ),
          legendItem("slot-other", "Others"),
        ]),
    legendItem("cat-knowledge", "Knowledge"),
    legendItem("cat-code", "Code"),
    legendItem("cat-activity", "Activity"),
    ...(solo
      ? []
      : [legendItem("cat-risk", "Risk: orphaned, island, fading, in a cycle")]),
  );

/** What the buttons above the cards do to the open state of the whole tree. */
export type TreeActions = {
  readonly expandAll: () => void;
  readonly collapseAll: () => void;
};

/**
 * The line above the cards: how many territories the detail shows and how many
 * are risky, the legend, and the buttons that open or close every card.
 * Without cards (`actions` is null) there is nothing to read the legend off or
 * to open, so both are left out.
 */
export const summaryLine = (
  facts: DetailSummary,
  report: Report,
  solo: boolean,
  actions: TreeActions | null,
): HTMLElement =>
  h(
    "div",
    "ksum",
    countLine(facts),
    ...(solo ? [] : [riskLine(facts)]),
    h("span", "sp"),
    ...(actions === null
      ? []
      : [
          cardLegend(report, solo),
          h(
            "span",
            "ctl2",
            button("Expand all", "all:expand", actions.expandAll),
            button("Collapse all", "all:collapse", actions.collapseAll),
          ),
        ]),
  );

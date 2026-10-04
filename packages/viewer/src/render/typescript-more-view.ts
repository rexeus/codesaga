import type { Report } from "@codesaga/engine";

import { moduleEraStory } from "../present/typescript-stories.js";
import type { TypeScriptDeepDive } from "../present/typescript-summary.js";
import { h } from "./dom.js";
import { automationCard } from "./typescript-automation-view.js";
import { ecosystemCard, modulesCard } from "./typescript-code-facts-view.js";
import { idiomsCard } from "./typescript-idioms-view.js";
import { markersCard, testsCard } from "./typescript-test-facts-view.js";
import { trendChart } from "./typescript-trend-view.js";

/**
 * The folded cards of the section under a heading of their own: idioms,
 * modules with the history of the ES module share, ecosystem, tests, markers
 * and the escapes by kind of commit. Empty when the report carries none.
 */
export const moreFacts = (
  { idioms, modules, ecosystem, tests, markers, trends }: TypeScriptDeepDive,
  stories: Report["stories"],
): HTMLElement[] => {
  const era = {
    chart: trends === undefined ? null : trendChart(trends, "esm"),
    story: moduleEraStory(stories)?.detail ?? null,
  };
  const cards = [
    idioms === undefined ? null : idiomsCard(idioms),
    modules === undefined ? null : modulesCard(modules, era),
    ecosystem === undefined ? null : ecosystemCard(ecosystem),
    tests === undefined ? null : testsCard(tests),
    markers === undefined ? null : markersCard(markers),
    trends === undefined ? null : automationCard(trends.escapesByAutomation),
  ].filter((card) => card !== null);
  return cards.length === 0
    ? []
    : [
        h(
          "div",
          "ts-group",
          h("h3", "", "More facts"),
          h("p", "", "Open a card to read it"),
        ),
        h("div", "fold-grid", ...cards),
      ];
};

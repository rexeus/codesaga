import { automationView } from "../present/typescript-automation.js";
import type { TypeScriptDeepDive } from "../present/typescript-summary.js";
import { h } from "./dom.js";
import { foldCard } from "./fold-card.js";

type Classes = NonNullable<
  NonNullable<TypeScriptDeepDive["trends"]>["escapesByAutomation"]
>;

const cells = (...values: readonly string[]): HTMLElement[] =>
  values.map((value) => h("span", "num", value));

/**
 * What the commits of each class (human, human with an AI agent, AI agent,
 * bot) added to and removed from the escape hatches, as a small table. Never
 * per person, and the agent figures are lower bounds. Null when no class
 * changed any TypeScript.
 */
export const automationCard = (classes: Classes): HTMLElement | null => {
  const view = automationView(classes);
  if (view === null) {
    return null;
  }
  return foldCard(
    "Escapes by kind of commit",
    "Sites added and removed, by who wrote the commit",
    view.teaser,
    h(
      "div",
      "ktable three",
      h(
        "div",
        "kt head",
        h("span", "", "Commits by"),
        ...cells("Added", "Removed"),
      ),
      ...view.rows.map(({ label, commits, added, removed }) =>
        h(
          "div",
          "kt",
          h(
            "span",
            "k two",
            h("span", "", label),
            h("span", "muted", `${commits} commits`),
          ),
          ...cells(added, removed),
        ),
      ),
    ),
    h("p", "note", view.caveat),
  );
};

import { h } from "./dom.js";
import { icon } from "./icons.js";

/**
 * A card that opens and closes: its title, subtitle and a line of what is
 * inside stay visible while it is closed. It is a native `<details>`, so it
 * works from the keyboard and without a script, and a find-in-page opens it.
 */
export const foldCard = (
  title: string,
  subtitle: string,
  teaser: string,
  ...content: readonly Node[]
): HTMLElement =>
  h(
    "details",
    "card fold",
    h(
      "summary",
      "fold-head",
      h(
        "div",
        "fold-title",
        h("h3", "chart-title", title),
        h("p", "chart-sub", subtitle),
        h("p", "fold-teaser", teaser),
      ),
      h("span", "fold-chevron", icon("chevron-down", 16, 2)),
    ),
    h("div", "fold-body", ...content),
  );

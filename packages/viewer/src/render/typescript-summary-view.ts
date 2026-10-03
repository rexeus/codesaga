import type { StoryLine } from "../present/typescript-stories.js";
import type {
  CoverageView,
  SummaryFigure,
  TypeScriptState,
} from "../present/typescript-summary.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";

const coverageNote = ({ headline, notes }: CoverageView): HTMLElement =>
  h(
    "p",
    "ts-note",
    icon("info", 14, 2),
    h("span", "", h("b", "", headline), ` · ${notes.join(" ")}`),
  );

const storyLine = ({ icon: glyph, title, detail }: StoryLine): HTMLElement =>
  h(
    "p",
    "ts-story",
    icon(glyph, 15, 2),
    h("span", "", h("b", "", title), ` — ${detail}`),
  );

const figure = ({ label, value, note }: SummaryFigure): HTMLElement =>
  h(
    "div",
    "ts-fig",
    h("div", "slabel", label),
    h("div", "ts-fig-value", value),
    h("div", "ts-fig-note", note),
  );

/**
 * The top of the section: the stories about the TypeScript code as lines, a
 * strip of the figures that sum up the code, and what the analysis could read. When the parser did not load or no file could
 * be read there are no figures, and the card says so calmly.
 */
export const summaryCard = (
  state: TypeScriptState,
  stories: readonly StoryLine[],
): HTMLElement => {
  if (state.kind !== "ready") {
    return h(
      "section",
      "card panel ts-calm",
      h("p", "ts-calm-text", state.message),
      coverageNote(state.coverage),
    );
  }
  const figures = h(
    "div",
    "ts-figs",
    ...state.figures.map((entry) => figure(entry)),
  );
  figures.style.setProperty("--figs", String(state.figures.length));
  return h(
    "section",
    "card panel ts-summary",
    ...(stories.length === 0
      ? []
      : [h("div", "ts-stories", ...stories.map((story) => storyLine(story)))]),
    figures,
    coverageNote(state.coverage),
  );
};

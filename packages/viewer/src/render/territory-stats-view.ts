import type { Comparison } from "../present/code-stats.js";
import type { IconName } from "../present/icons.js";
import type { TerritoryStatsView } from "../present/territory-stats.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";
import { languageBar } from "./language-bar.js";

const LEGEND_LANGUAGES = 4;

const labelled = (glyph: IconName, label: string): HTMLElement =>
  h("div", "slabel", icon(glyph, 14, 2), label);

const item = (
  glyph: IconName,
  label: string,
  ...body: readonly Node[]
): HTMLElement => h("div", "sitem", labelled(glyph, label), ...body);

const caption = (...content: readonly (Node | string)[]): HTMLElement =>
  h("div", "cap", ...content);

const mono = (text: string, title: string): HTMLElement => {
  const element = h("span", "mono", text);
  element.title = title;
  return element;
};

const percentOf = (fraction: number): string => `${fraction * 100}%`;

/** A bar with the territory's figure as its fill and the repository's as a tick across it. */
const comparisonBar = (
  { value, reference }: Comparison,
  description: string,
): HTMLElement => {
  const fill = h("i", "fill");
  fill.style.width = percentOf(value);
  const mark = h("i", "ref");
  mark.style.left = percentOf(reference);
  const bar = h("div", "cmp", fill, mark);
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", description);
  return bar;
};

const figure = (label: string, value: string): HTMLElement =>
  h("span", "", `${label} `, h("b", "", value));

const fileLength = ({
  fileLength: length,
}: TerritoryStatsView): HTMLElement => {
  const dot = h("i", "rdot");
  dot.style.left = percentOf(length.position);
  const range = h("div", "range", h("i", "rfill"), dot);
  range.setAttribute("role", "img");
  range.setAttribute(
    "aria-label",
    `File length from ${length.min} to ${length.max} lines, median ${length.median}`,
  );
  return item(
    "ruler",
    "File length",
    range,
    h(
      "div",
      "mm",
      figure("min", length.min),
      figure("median", length.median),
      figure("max", length.max),
    ),
  );
};

const weighted = (files: number, entity: string): HTMLElement => {
  const segment = h("i", entity);
  segment.style.flex = `${Math.max(files, 0.0001)} 1 0`;
  return segment;
};

const testShare = ({ tests }: TerritoryStatsView): HTMLElement => {
  const stack = h(
    "div",
    "tbar",
    weighted(tests.files, "slot-6"),
    weighted(tests.otherFiles, "slot-other"),
  );
  return item(
    "flask-conical",
    "Test share",
    stack,
    caption(h("b", "", tests.share), ` of the files · ${tests.caption}`),
  );
};

const churn = ({ churn: figures }: TerritoryStatsView): HTMLElement =>
  item(
    "refresh-cw",
    "Churn",
    caption(
      "Median file changed ",
      h("b", "", figures.figure),
      " times · p90 ",
      h("b", "", figures.p90),
    ),
    comparisonBar(
      figures.comparison,
      `Median revisions ${figures.figure} here, against the repository's`,
    ),
    ...(figures.mostChanged === null
      ? []
      : [
          h(
            "div",
            "cap sub",
            "Most changed: ",
            mono(figures.mostChanged.name, figures.mostChanged.path),
            ` · ${figures.mostChanged.revisions} revisions`,
          ),
        ]),
  );

const complexity = ({ complexity: figures }: TerritoryStatsView): HTMLElement =>
  item(
    "indent-increase",
    "Complexity",
    caption(
      h("b", "", figures.figure),
      " indentation levels per line",
      h("span", "muted", ` · median file ${figures.medianFile}`),
    ),
    comparisonBar(
      figures.comparison,
      `${figures.figure} levels per line here, against the repository's`,
    ),
    ...(figures.deepest === null
      ? []
      : [
          h(
            "div",
            "cap sub",
            "Deepest: ",
            mono(figures.deepest.name, figures.deepest.path),
            ` · ${figures.deepest.perLine} per line`,
          ),
        ]),
  );

const style = ({ style: facts }: TerritoryStatsView): HTMLElement =>
  item(
    "align-left",
    "Style",
    h(
      "div",
      "facts",
      h("span", "", h("b", "", facts.indentation.headline), " indent"),
      h(
        "span",
        "",
        "lines ",
        h("b", "", facts.lineLength.median),
        " median · ",
        h("b", "", facts.lineLength.p90),
        " p90",
      ),
      h("span", "", h("b", "", facts.comments), " comment lines"),
    ),
  );

const counts = ({ files, lines }: TerritoryStatsView): HTMLElement =>
  h(
    "div",
    "sitem two",
    h("div", "", labelled("files", "Files"), h("div", "sbig", files)),
    h("div", "", labelled("text", "Lines"), h("div", "sbig", lines)),
  );

const key = (): HTMLElement =>
  h(
    "div",
    "scmp",
    h("i", "fill"),
    " this territory",
    h("i", "ref"),
    " repository",
  );

/**
 * The stats of a territory as a panel: languages, size, file length, test
 * share, churn, complexity and style, with the churn and complexity bars
 * marked with the repository's figure. Only facts; nothing is graded.
 */
export const statsPanel = (view: TerritoryStatsView): HTMLElement =>
  h(
    "div",
    "spanel",
    item(
      "languages",
      "Languages",
      ...languageBar(view.languages, LEGEND_LANGUAGES),
    ),
    counts(view),
    fileLength(view),
    testShare(view),
    churn(view),
    complexity(view),
    style(view),
    key(),
  );

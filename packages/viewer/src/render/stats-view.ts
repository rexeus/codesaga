import type { Report } from "@codesaga/engine";

import { formatCount } from "../present/format.js";
import { histogramViews } from "../present/histograms.js";
import { languageEntities } from "../present/languages.js";
import {
  changedFileRows,
  hasStats,
  languageRows,
  styleRows,
  testRows,
} from "../present/stats.js";
import type {
  ChangedFileRow,
  LanguageRow,
  StyleRow,
  TestRow,
} from "../present/stats.js";
import { h, mono } from "./dom.js";
import { histogramCard } from "./histogram-card.js";
import { icon } from "./icons.js";
import { legend, legendItem, section } from "./section.js";
import { bindTooltip } from "./tooltip.js";

const DESCRIPTION =
  "Facts about the code at HEAD and the commits behind it. Nothing here is a score or a ranking.";

const card = (
  title: string,
  subtitle: string,
  ...content: readonly Node[]
): HTMLElement =>
  h(
    "section",
    "card chart",
    h(
      "div",
      "chart-head",
      h(
        "div",
        "",
        h("h3", "chart-title", title),
        h("p", "chart-sub", subtitle),
      ),
    ),
    ...content,
  );

const weightedSegment = (
  weight: number,
  entity: string,
  tip: string,
): HTMLElement => {
  const segment = h("i", entity);
  segment.style.flex = `${Math.max(weight, 0.0001)} 1 0`;
  bindTooltip(segment, { title: tip, rows: [] });
  return segment;
};

const cells = (...values: readonly string[]): HTMLElement[] =>
  values.map((value) => h("span", "", value));

const languagesCard = (rows: readonly LanguageRow[]): HTMLElement => {
  const bar = h(
    "div",
    "lang-bar big",
    ...rows.map(({ entity, loc, name }) =>
      weightedSegment(
        loc,
        `lang-segment ${entity}`,
        `${name}: ${formatCount(loc)} lines`,
      ),
    ),
  );
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", "Languages by lines of code");
  return card(
    "Languages",
    "Share of code lines",
    bar,
    h(
      "div",
      "ltable",
      h("div", "lt head", ...cells("Language", "Files", "Lines", "Share")),
      ...rows.map(({ entity, name, files, loc, share }) =>
        h(
          "div",
          "lt",
          h("span", "k", h("i", `swatch ${entity}`), name),
          ...cells(formatCount(files), formatCount(loc), share),
        ),
      ),
    ),
  );
};

const testRow = ({
  label,
  tests,
  others,
  share,
  caption,
}: TestRow): HTMLElement =>
  h(
    "div",
    "tvrow",
    h("div", "tvh", h("span", "slabel", label), h("span", "muted", caption)),
    h(
      "div",
      "tbar big",
      weightedSegment(tests, "slot-6", `${label}: ${formatCount(tests)} test`),
      weightedSegment(
        others,
        "slot-other",
        `${label}: ${formatCount(others)} other`,
      ),
    ),
    h("div", "tvp", h("b", "", share), " tests"),
  );

const testsCard = (rows: readonly TestRow[]): HTMLElement =>
  card(
    "Tests and code",
    "Test files are found by folder and file name",
    ...rows.map((row) => testRow(row)),
    legend(
      legendItem("slot-6", "Test code"),
      legendItem("slot-other", "Other code"),
    ),
  );

const changedCard = (rows: readonly ChangedFileRow[]): HTMLElement =>
  card(
    "Most changed files",
    "Revisions per file, top 5",
    h(
      "div",
      "toplist",
      ...rows.map(({ name, path, revisions, fraction }) => {
        const fill = h("i", "");
        fill.style.width = `${fraction * 100}%`;
        return h(
          "div",
          "tl",
          mono(name, path),
          h("span", "bar", fill),
          h("b", "", revisions),
        );
      }),
    ),
  );

const styleRow = ({
  label,
  icon: glyph,
  lead,
  rest,
  bar,
}: StyleRow): HTMLElement => {
  const value = h("div", "v", h("b", "", lead), h("span", "muted", rest));
  const track =
    bar === null
      ? []
      : [
          h(
            "div",
            "pbar",
            ...bar.map(({ entity, share }) =>
              weightedSegment(share, entity, `${Math.round(share * 100)}%`),
            ),
          ),
        ];
  return h(
    "div",
    "srow",
    h("div", "slabel", icon(glyph, 14, 2), label),
    h("div", "sval", value, ...track),
  );
};

const styleCard = (rows: readonly StyleRow[]): HTMLElement =>
  card(
    "Style and habits",
    "How the code and the commits are written",
    h("div", "srows", ...rows.map((row) => styleRow(row))),
  );

/**
 * The code in numbers: file length, revisions and complexity as histograms,
 * the languages, tests against code, the most changed files, and the style and
 * habits. Facts only; nothing is graded or ranked.
 */
export const renderStats = (report: Report): HTMLElement => {
  const { stats } = report;
  if (!hasStats(stats)) {
    return section(
      "stats",
      "Stats",
      "The code in numbers",
      DESCRIPTION,
      h(
        "p",
        "empty",
        "The analysis found no code files, so there is nothing to count.",
      ),
    );
  }
  const entityOf = languageEntities(report.overview.languages);
  return section(
    "stats",
    "Stats",
    "The code in numbers",
    DESCRIPTION,
    h(
      "div",
      "grid12",
      h(
        "div",
        "c7 col",
        ...histogramViews(stats).map((view) => histogramCard(view)),
      ),
      h(
        "div",
        "c5 col",
        languagesCard(languageRows(stats.languages, entityOf)),
        testsCard(testRows(stats)),
        ...(stats.churn.mostChanged.length === 0
          ? []
          : [changedCard(changedFileRows(stats))]),
        styleCard(styleRows(stats)),
      ),
    ),
  );
};

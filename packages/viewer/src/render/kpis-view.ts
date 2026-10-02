import type { Report } from "@codesaga/engine";

import { layoutSparkline } from "../layout/sparkline.js";
import { formatCount } from "../present/format.js";
import { keyFigures } from "../present/key-figures.js";
import type { Foot, KeyFigure, Trend } from "../present/key-figures.js";
import type { LanguageShare } from "../present/languages.js";
import { h, s } from "./dom.js";
import { icon } from "./icons.js";
import { legend, legendItem } from "./section.js";
import { bindTooltip } from "./tooltip.js";

const SPARK_WIDTH = 232;
const LEGEND_LANGUAGES = 3;

const sparkline = (trend: Trend | null, height: number): SVGElement[] => {
  const layout =
    trend === null
      ? null
      : layoutSparkline(
          trend.values,
          { width: SPARK_WIDTH, height },
          trend.recent,
        );
  if (layout === null) {
    return [];
  }
  return [
    s(
      "svg",
      {
        class: "spark",
        width: "100%",
        height,
        viewBox: `0 0 ${SPARK_WIDTH} ${height}`,
        "aria-hidden": "true",
      },
      s("path", { class: "full", d: layout.area }),
      s("path", { class: "history", d: layout.history }),
      s("path", { class: "recent", d: layout.recent }),
      s("circle", { class: "end", cx: layout.end.x, cy: layout.end.y, r: 4.5 }),
    ),
  ];
};

const segment = (share: LanguageShare): HTMLElement => {
  const element = h("div", `lang-segment ${share.entity}`);
  element.style.flexGrow = String(share.loc);
  bindTooltip(element, {
    title: share.name,
    rows: [
      {
        label: "of the lines of code",
        value: `${share.percent.toFixed(1)}%`,
        key: share.entity,
      },
      { label: "lines of code", value: formatCount(share.loc) },
      { label: "files", value: formatCount(share.files) },
    ],
  });
  return element;
};

const languageBar = (shares: readonly LanguageShare[]): HTMLElement[] => {
  if (shares.length === 0) {
    return [];
  }
  const bar = h("div", "lang-bar", ...shares.map((share) => segment(share)));
  bar.setAttribute("role", "img");
  bar.setAttribute(
    "aria-label",
    shares
      .map(({ name, percent }) => `${name} ${percent.toFixed(1)}%`)
      .join(", "),
  );
  return [
    bar,
    legend(
      ...shares
        .slice(0, LEGEND_LANGUAGES)
        .map(({ entity, name, percent }) =>
          legendItem(entity, `${name} ${Math.round(percent)}%`),
        ),
    ),
  ];
};

const deltaFoot = (foot: Extract<Foot, { kind: "delta" }>): HTMLElement =>
  h(
    "div",
    `delta ${foot.direction === "down" ? "down" : ""}`,
    ...(foot.direction === "flat"
      ? []
      : [
          icon(
            foot.direction === "up" ? "arrow-up-right" : "arrow-down-right",
            14,
            2.2,
          ),
        ]),
    foot.text,
    h("span", "", ` ${foot.against}`),
  );

const personFoot = (foot: Extract<Foot, { kind: "person" }>): HTMLElement[] => [
  h(
    "div",
    "solo-author",
    h("span", `avatar ${foot.entity}`, foot.initials),
    h("span", "", foot.name),
  ),
  h("div", "cap", foot.detail),
];

const peopleFoot = (foot: Extract<Foot, { kind: "people" }>): HTMLElement[] => [
  h(
    "div",
    "truck-dots",
    ...Array.from({ length: foot.count }, () => h("i", "")),
  ),
  foot.solo
    ? h("span", "pill warn", icon("truck", 13), "Solo repository")
    : h("div", "cap", foot.caption),
];

const footOf = (foot: Foot): HTMLElement[] => {
  if (foot.kind === "delta") {
    return [deltaFoot(foot)];
  }
  if (foot.kind === "caption") {
    return [h("div", "cap", foot.text)];
  }
  if (foot.kind === "person") {
    return personFoot(foot);
  }
  return foot.kind === "languages"
    ? languageBar(foot.shares)
    : peopleFoot(foot);
};

const card = ({ label, value, unit, trend, foot }: KeyFigure): HTMLElement =>
  h(
    "li",
    "card kpi",
    h("div", "label", label),
    h("div", "value", value, ...(unit === null ? [] : [h("small", "", unit)])),
    h(
      "div",
      "foot",
      ...sparkline(trend, foot.kind === "languages" ? 34 : 40),
      ...footOf(foot),
    ),
  );

/** The four key figures under the header: commits, active contributors, lines of code and the truck factor. */
export const renderKeyFigures = (report: Report): HTMLElement =>
  h("ul", "kpis", ...keyFigures(report).map((figure) => card(figure)));

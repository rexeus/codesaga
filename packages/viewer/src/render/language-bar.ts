import { formatCount } from "../present/format.js";
import type { LanguageShare } from "../present/languages.js";
import { h } from "./dom.js";
import { legend, legendItem } from "./section.js";
import { bindTooltip } from "./tooltip.js";

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

/**
 * The languages as one stacked bar and a legend of the first `legendCount`;
 * nothing for no languages. Every segment has a tooltip with its lines and files.
 */
export const languageBar = (
  shares: readonly LanguageShare[],
  legendCount: number,
): HTMLElement[] => {
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
        .slice(0, legendCount)
        .map(({ entity, name, percent }) =>
          legendItem(entity, `${name} ${Math.round(percent)}%`),
        ),
    ),
  ];
};

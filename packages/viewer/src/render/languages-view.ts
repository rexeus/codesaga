import type { Report } from "@codesaga/engine";

import { formatCount } from "../present/format.js";
import { languageShares } from "../present/languages.js";
import type { LanguageShare } from "../present/languages.js";
import { h } from "./dom.js";
import { legend, legendItem, section } from "./section.js";
import { bindTooltip } from "./tooltip.js";

const percent = ({ percent: value }: LanguageShare): string =>
  `${value.toFixed(1)}%`;

const segment = (share: LanguageShare): HTMLElement => {
  const element = h("div", `lang-segment ${share.entity}`);
  element.style.flexGrow = String(share.loc);
  bindTooltip(element, {
    title: share.name,
    rows: [
      {
        label: "of the lines of code",
        value: percent(share),
        key: share.entity,
      },
      { label: "lines of code", value: formatCount(share.loc) },
      { label: "files", value: formatCount(share.files) },
    ],
  });
  return element;
};

/** Lines of code per language as one horizontal bar with a labelled legend. */
export const renderLanguages = ({ overview }: Report): HTMLElement => {
  const shares = languageShares(overview.languages);
  const description = "Lines of code per language";
  if (shares.length === 0) {
    return section(
      "languages",
      "Languages",
      description,
      h("p", "empty", "No code files found."),
    );
  }
  const bar = h("div", "lang-bar", ...shares.map((share) => segment(share)));
  bar.setAttribute("role", "img");
  bar.setAttribute(
    "aria-label",
    shares.map((share) => `${share.name} ${percent(share)}`).join(", "),
  );
  return section(
    "languages",
    "Languages",
    description,
    bar,
    legend(
      ...shares.map((share) =>
        legendItem(
          share.entity,
          share.name,
          `${percent(share)} · ${formatCount(share.loc)} lines`,
        ),
      ),
    ),
  );
};

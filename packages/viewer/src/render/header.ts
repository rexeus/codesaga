import type { Report } from "@codesaga/engine";

import { formatDate } from "../present/format.js";
import { keyFigures } from "../present/key-figures.js";
import { h } from "./dom.js";

const SHORT_SHA_LENGTH = 7;

const summaryParts = ({
  repository,
  window,
  generatedAt,
}: Report): string[] => [
  ...(repository.branch === null ? [] : [repository.branch]),
  ...(repository.head === null
    ? []
    : [repository.head.slice(0, SHORT_SHA_LENGTH)]),
  `${formatDate(window.since)} → ${formatDate(window.until)}`,
  `generated ${formatDate(generatedAt)}`,
];

/** The repository name, its branch, HEAD and window, and a warning for a shallow clone. */
export const renderHeader = (report: Report): HTMLElement => {
  const { name, scope, shallow } = report.repository;
  return h(
    "header",
    "header",
    h("h1", "", scope === "." ? name : `${name} / ${scope}`),
    h("p", "summary", summaryParts(report).join(" · ")),
    ...(shallow
      ? [
          h(
            "p",
            "notice",
            "Shallow clone: history before the oldest fetched commit is missing, so counts undercount. `git fetch --unshallow` completes it.",
          ),
        ]
      : []),
  );
};

/** The key-figure tiles. */
export const renderTiles = (report: Report): HTMLElement =>
  h(
    "ul",
    "tiles",
    ...keyFigures(report).map(({ label, value, detail }) =>
      h(
        "li",
        "tile",
        h("span", "tile-label", label),
        h("strong", "tile-value", value),
        h("span", "tile-detail", detail),
      ),
    ),
  );

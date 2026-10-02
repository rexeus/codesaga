import type { Report } from "@codesaga/engine";

import { renderActivity } from "./activity-view.js";
import { renderContributors } from "./contributors-view.js";
import { h } from "./dom.js";
import { renderHeader } from "./header.js";
import { renderKnowledge } from "./knowledge-view.js";
import { renderKeyFigures } from "./kpis-view.js";
import { renderPullRequests } from "./pull-requests-view.js";

const footer = ({ tool, generatedAt }: Report): HTMLElement =>
  h(
    "footer",
    "",
    h(
      "span",
      "",
      `codesaga ${tool.version} · ${generatedAt.slice(0, 10)} · one self-contained file, works offline`,
    ),
  );

/** Renders the whole dashboard for `report` into `root`. */
export const mountApp = (report: Report, root: HTMLElement): void => {
  const pullRequests = renderPullRequests(report);
  root.replaceChildren(
    renderHeader(report),
    h(
      "main",
      "wrap",
      renderKeyFigures(report),
      renderActivity(report),
      ...(pullRequests === null ? [] : [pullRequests]),
      renderKnowledge(report),
      renderContributors(report),
      footer(report),
    ),
  );
};

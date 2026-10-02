import type { Report } from "@codesaga/engine";

import { renderAchievements } from "./achievements-view.js";
import { renderActivity } from "./activity-view.js";
import { renderBots } from "./bots-view.js";
import { renderContributors } from "./contributors-view.js";
import { h } from "./dom.js";
import { renderHeader } from "./header.js";
import { renderKnowledge } from "./knowledge-view.js";
import { renderKeyFigures } from "./kpis-view.js";
import { renderPullRequests } from "./pull-requests-view.js";
import { renderStats } from "./stats-view.js";
import { renderStories } from "./stories-view.js";

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
  const stories = renderStories(report);
  const pullRequests = renderPullRequests(report);
  const bots = renderBots(report);
  root.replaceChildren(
    renderHeader(report),
    h(
      "main",
      "wrap",
      renderKeyFigures(report),
      ...(stories === null ? [] : [stories]),
      renderActivity(report),
      ...(pullRequests === null ? [] : [pullRequests]),
      renderKnowledge(report),
      renderStats(report),
      renderAchievements(report),
      renderContributors(report),
      ...(bots === null ? [] : [bots]),
      footer(report),
    ),
  );
};

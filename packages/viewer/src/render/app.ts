import type { Report } from "@codesaga/engine";

import { renderActivity } from "./activity-view.js";
import { renderAutomation } from "./automation-view.js";
import { renderContributors } from "./contributors-view.js";
import { renderHeader, renderTiles } from "./header.js";
import { renderKnowledge } from "./knowledge-view.js";
import { renderLanguages } from "./languages-view.js";
import { renderPullRequests } from "./pull-requests-view.js";
import { renderPunchcard } from "./punchcard-view.js";

/** Renders the whole dashboard for `report` into `root`. */
export const mountApp = (report: Report, root: HTMLElement): void => {
  const pullRequests = renderPullRequests(report);
  root.replaceChildren(
    renderHeader(report),
    renderTiles(report),
    renderActivity(report),
    renderAutomation(report),
    ...(pullRequests === null ? [] : [pullRequests]),
    renderKnowledge(report),
    renderContributors(report),
    renderPunchcard(report),
    renderLanguages(report),
  );
};

import type { Report } from "@codesaga/engine";

import { renderActivity } from "./activity-view.js";
import { renderAutomation } from "./automation-view.js";
import { renderContributors } from "./contributors-view.js";
import { renderHeader, renderTiles } from "./header.js";
import { renderLanguages } from "./languages-view.js";
import { renderPunchcard } from "./punchcard-view.js";

/** Renders the whole dashboard for `report` into `root`. */
export const mountApp = (report: Report, root: HTMLElement): void => {
  root.replaceChildren(
    renderHeader(report),
    renderTiles(report),
    renderActivity(report),
    renderAutomation(report),
    renderContributors(report),
    renderPunchcard(report),
    renderLanguages(report),
  );
};

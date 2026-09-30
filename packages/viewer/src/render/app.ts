import type { Report } from "@codesaga/engine";

import { renderActivity } from "./activity-view.js";
import { renderHeader, renderTiles } from "./header.js";

/** Renders the whole dashboard for `report` into `root`. */
export const mountApp = (report: Report, root: HTMLElement): void => {
  root.replaceChildren(
    renderHeader(report),
    renderTiles(report),
    renderActivity(report),
  );
};

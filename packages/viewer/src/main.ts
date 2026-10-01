import { parseReport, REPORT_ELEMENT_ID } from "./document/embedded-report.js";
import { mountApp } from "./render/app.js";
import { byId } from "./render/dom.js";

/** Browser entry: reads the report the page template embedded and renders it. */
const embedded = document.querySelector(`#${REPORT_ELEMENT_ID}`);
if (embedded === null) {
  throw new Error("The page has no embedded report.");
}
mountApp(parseReport(embedded.textContent ?? ""), byId("app", HTMLElement));

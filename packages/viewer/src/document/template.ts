import type { Report } from "@codesaga/engine";

import { viewerScript, viewerStyles } from "../../dist/assets.js";
import { REPORT_ELEMENT_ID, serializeReport } from "./embedded-report.js";

const escapeHtmlText = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/**
 * The complete viewer page for `report`, as one self-contained HTML document:
 * styles, script and data are inline, and a content security policy forbids
 * loading anything from the network.
 * The report is embedded whole; the page renders every name and path as text.
 */
export const renderReportHtml = (report: Report): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
<link rel="icon" href="data:,">
<title>codesaga · ${escapeHtmlText(report.repository.name)}</title>
<style>${viewerStyles}</style>
</head>
<body>
<svg id="svg-root" width="0" height="0" aria-hidden="true"></svg>
<div id="app" class="app"><noscript>The dashboard needs JavaScript; the report is embedded as JSON in this file.</noscript></div>
<div id="tooltip" class="tooltip" role="tooltip" hidden></div>
<div id="chart-status" class="visually-hidden" aria-live="polite" aria-atomic="true"></div>
<script type="application/json" id="${REPORT_ELEMENT_ID}">${serializeReport(report)}</script>
<script>${viewerScript}</script>
</body>
</html>
`;

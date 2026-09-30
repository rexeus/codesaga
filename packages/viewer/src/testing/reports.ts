import type { Report } from "@codesaga/engine";

import sample from "../../../../fixtures/report.sample.json" with { type: "json" };
import { parseReport } from "../document/embedded-report.js";

/** The hand-written three-year report of `fixtures/report.sample.json`. */
export const sampleReport = (): Report => parseReport(JSON.stringify(sample));

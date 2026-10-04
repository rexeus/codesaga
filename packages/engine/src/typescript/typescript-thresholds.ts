// Owns the thresholds of the TypeScript deep dive, gathered from the modules that apply them.
// Reported as `thresholds.typescript`, so consumers see the bands next to the figures read through them.

import type { Report } from "../report/report.js";
import {
  COMPLEXITY_EDGES,
  COMPLEXITY_LIMIT,
  HOTSPOT_MIN_COMPLEXITY,
  HOTSPOT_MIN_REVISIONS,
  HOTSPOT_QUANTILE,
  LENGTH_EDGES,
  MAX_PARAMETERS,
} from "./functions/function-thresholds.js";
import { IMPORT_THRESHOLDS } from "./imports/thresholds.js";
import { MAX_MEAN_LINE_LENGTH, MAX_SOURCE_CHARACTERS } from "./input-guards.js";
import { ASSERTION_EDGES } from "./tests/test-facts.js";

/** The bands and limits every report applies to TypeScript code. */
export const TYPESCRIPT_THRESHOLDS: NonNullable<
  Report["thresholds"]["typescript"]
> = {
  complexityBands: COMPLEXITY_EDGES,
  complexityLimit: COMPLEXITY_LIMIT,
  lengthBands: LENGTH_EDGES,
  maxParameters: MAX_PARAMETERS,
  assertionBands: ASSERTION_EDGES,
  hotspotQuantile: HOTSPOT_QUANTILE,
  hotspotMinComplexity: HOTSPOT_MIN_COMPLEXITY,
  hotspotMinRevisions: HOTSPOT_MIN_REVISIONS,
  maxSourceCharacters: MAX_SOURCE_CHARACTERS,
  minifiedMeanLineLength: MAX_MEAN_LINE_LENGTH,
  imports: IMPORT_THRESHOLDS,
};

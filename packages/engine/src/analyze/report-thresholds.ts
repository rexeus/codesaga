// Owns the thresholds of a report: every constant the analysis applied, gathered from the modules that own them.
// Reported as `thresholds`, so consumers see the rules next to the numbers they produced.

import { ACHIEVEMENT_THRESHOLDS } from "../achievements/thresholds.js";
import { CONTRIBUTOR_BADGE_THRESHOLDS } from "../badges/contributor-badge-thresholds.js";
import { TERRITORY_BADGE_THRESHOLDS } from "../badges/territory-badge-thresholds.js";
import { ACTIVE_DAYS } from "../contributors/activeness.js";
import {
  KNOWLEDGE_THRESHOLDS,
  TERRITORY_THRESHOLDS,
} from "../knowledge/knowledge.js";
import type { Report } from "../report/report.js";
import { STORY_THRESHOLDS } from "../stories/thresholds.js";

/** The constants every report applies. */
export const THRESHOLDS: Report["thresholds"] = {
  activeDays: ACTIVE_DAYS,
  ...KNOWLEDGE_THRESHOLDS,
  territories: TERRITORY_THRESHOLDS,
  stories: STORY_THRESHOLDS,
  badges: { ...TERRITORY_BADGE_THRESHOLDS, ...CONTRIBUTOR_BADGE_THRESHOLDS },
  achievements: ACHIEVEMENT_THRESHOLDS,
};

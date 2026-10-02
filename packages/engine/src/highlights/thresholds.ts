// Owns the constants that decide when a highlight is notable, reported as `thresholds.highlights`.
// One place, so a rule changes without touching the families that read the facts.
import { NEW_CONTRIBUTOR_DAYS } from "../contributors/status.js";

/** The rules behind the highlights, for the report's `thresholds.highlights`. */
export const HIGHLIGHT_THRESHOLDS = {
  streakMinDays: 7,
  busiestDayMinCommits: 5,
  rhythmMinCommits: 20,
  nightOwlShare: 0.2,
  nightFromHour: 22,
  nightToHour: 5,
  weekendShare: 0.25,
  quietAreaMonths: 6,
  newcomersMinPeople: 2,
  newcomerDays: NEW_CONTRIBUTOR_DAYS,
  anniversaryWindowDays: 7,
  cleanupMinNetDeletedLines: 200,
  renameRecordMinRenames: 3,
};

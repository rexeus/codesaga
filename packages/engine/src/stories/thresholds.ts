// Owns the constants that decide when a story is notable, reported as `thresholds.stories`.
// One place, so a rule changes without touching the families that read the facts.
import { NEW_CONTRIBUTOR_DAYS } from "../contributors/status.js";

/** The rules behind the stories, for the report's `thresholds.stories`. */
export const STORY_THRESHOLDS = {
  streakMinDays: 7,
  busiestDayMinCommits: 5,
  rhythmMinCommits: 20,
  nightOwlShare: 0.2,
  nightFromHour: 22,
  nightToHour: 5,
  weekendShare: 0.25,
  quietTerritoryMonths: 6,
  newcomersMinPeople: 2,
  newcomerDays: NEW_CONTRIBUTOR_DAYS,
  anniversaryWindowDays: 7,
  cleanupMinNetDeletedLines: 200,
  renameRecordMinRenames: 3,
};

// Owns the constants that decide when an achievement is reached, reported as `thresholds.achievements`.
// One place, so a rule changes without touching the code that reads the facts.
import { NEW_CONTRIBUTOR_DAYS } from "../contributors/status.js";

/** The rules behind the achievements, for the report's `thresholds.achievements`. */
export const ACHIEVEMENT_THRESHOLDS = {
  firstCommitsTiers: [1000, 10_000],
  marathonDays: 1000,
  communityTiers: [10, 50, 100],
  busProofTruckFactor: 5,
  polyglotLanguages: 5,
  polyglotMinShare: 0.01,
  testCultureShare: 0.3,
  unbrokenDays: 30,
  springCleaningNetLines: 1000,
  freshBloodPeople: 5,
  freshBloodDays: NEW_CONTRIBUTOR_DAYS,
  anyFreeMinFiles: 50,
  typeScriptMinFiles: 10,
  tightenedFall: 0.5,
  tightenedMinPeakEscapes: 20,
};

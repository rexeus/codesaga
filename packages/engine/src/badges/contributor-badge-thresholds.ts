// Owns the constants behind the contributor badges, reported as `thresholds.badges`.
// One place, so the rule families and the report read the same numbers.
import { NEW_CONTRIBUTOR_DAYS } from "../contributors/status.js";
import { RHYTHM_BADGE_THRESHOLDS } from "./contributor-rhythm.js";
import { TENURE_BADGE_THRESHOLDS } from "./contributor-tenure.js";

/** The rules behind the contributor badges, for the report's `thresholds.badges`. */
export const CONTRIBUTOR_BADGE_THRESHOLDS = {
  allRounderTerritoryShare: 0.5,
  allRounderMinTerritories: 4,
  specialistShare: 0.8,
  tidierNetDeletedLines: 500,
  founderShare: 0.25,
  testerShare: 0.4,
  documenterShare: 0.4,
  minCommitsForShare: 10,
  ...TENURE_BADGE_THRESHOLDS,
  ...RHYTHM_BADGE_THRESHOLDS,
  recentWindowDays: 365,
  pairPartnerCommits: 5,
  longHaulerYears: 3,
  longHaulerQuarters: 4,
  explorerDays: NEW_CONTRIBUTOR_DAYS,
  explorerMinTerritories: 3,
  toolsmithShare: 0.3,
  toolsmithMinCommits: 10,
  craftMaxFilesPerCommit: 50,
  typeTightenerRemovedAny: 20,
  typeTightenerMinCommits: 8,
  sweeperRemovedDeclarations: 15,
  simplifierFunctions: 10,
  simplifierMinDrop: 3,
  testCompanionCommits: 10,
  testCompanionShare: 0.5,
  /** Reserved: `reviewer` needs GitHub logins mapped to identities and is not awarded yet. */
  reviewerReviews: 10,
};

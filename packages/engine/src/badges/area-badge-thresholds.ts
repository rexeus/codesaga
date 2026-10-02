// Owns the constants that decide when an area earns a badge, reported as `thresholds.badges`.
// One place, so a rule changes without touching the rules that read the area.

/** The rules behind the area badges, for the report's `thresholds.badges`. */
export const AREA_BADGE_THRESHOLDS = {
  sharedActiveExperts: 4,
  sharedTruckFactor: 4,
  fadingFromDays: 90,
  fadingToDays: 183,
  newDays: 90,
  newAfterStartDays: 180,
  handoverDays: 180,
  inFocusDays: 90,
  quietDays: 183,
  newcomerFriendlyFirstCommits: 2,
  newcomerFriendlyDays: 180,
  wellTestedShare: 0.4,
};

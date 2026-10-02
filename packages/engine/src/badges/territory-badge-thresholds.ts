// Owns the constants that decide when a territory earns a badge, reported as `thresholds.badges`.
// One place, so a rule changes without touching the rules that read the territory.

/** The rules behind the territory badges, for the report's `thresholds.badges`. */
export const TERRITORY_BADGE_THRESHOLDS = {
  sharedActiveExperts: 4,
  sharedTruckFactor: 4,
  fadingFromDays: 90,
  fadingToDays: 183,
  newTerritoryDays: 90,
  newTerritoryAfterStartDays: 180,
  handoverDays: 180,
  inFocusDays: 90,
  quietDays: 183,
  newcomerFriendlyFirstCommits: 2,
  newcomerFriendlyDays: 180,
  wellTestedShare: 0.4,
  heavyweightShare: 0.2,
  heavyweightMedianFileLines: 400,
  hotspotShare: 0.25,
  churningRatio: 1.5,
  churningMinRevisions: 5,
  nestedRatio: 1.4,
  nestedMinLevels: 1,
  codeBadgeMinSiblings: 3,
  codeBadgeFairShareFactor: 2,
};

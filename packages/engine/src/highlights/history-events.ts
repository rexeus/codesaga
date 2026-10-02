// @scaffold Owns the highlights that name an event in the history: anniversary, newcomers, rename record and biggest cleanup.
// @scaffold Separate from `rhythm.ts` because these read what a commit changed or who it came from, not when it landed.
// @scaffold Cost: one pass over the commits; the rename record needs rename counts the history does not expose yet.

import type { Highlight } from "../report/highlights.js";
import type { HighlightFacts } from "./highlights.js";

/**
 * The `anniversary`, `newcomers`, `rename-record` and `biggest-cleanup`
 * findings that pass their thresholds. An anniversary falls within 7 days of
 * the repository's first commit day; newcomers made their first commit in the
 * last 90 days; the biggest cleanup is the commit with the most net deleted
 * code lines.
 */
export const historyEventHighlights = (
  facts: HighlightFacts,
): ReadonlyArray<Highlight> => {
  throw new Error(`not implemented: ${facts.commits.length}`);
};

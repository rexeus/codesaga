// @scaffold Owns the highlights read off the clock: longest streak, busiest day, night owls and weekend share.
// @scaffold Separate from `history-events.ts` because these four only need commit times and the author's local time.
// @scaffold Cost: one pass over the commits.

import type { Highlight } from "../report/highlights.js";
import type { HighlightFacts } from "./highlights.js";

/**
 * The `streak`, `busiest-day`, `night-owls` and `weekend` findings that pass
 * their thresholds. The streak is the longest run of local days with a commit
 * in the repository; night owls are human commits from 22:00 to 05:00 local
 * time, the weekend share counts Saturdays and Sundays. Bot and agent commits
 * never count toward the two shares.
 */
export const rhythmHighlights = (
  facts: HighlightFacts,
): ReadonlyArray<Highlight> => {
  throw new Error(`not implemented: ${facts.commits.length}`);
};

// @scaffold Owns the highlights that restate the knowledge section: quiet area, truck-factor alert and orphaned knowledge.
// @scaffold Separate from the other families because it reads the areas and the truck factor rather than the commits alone.
// @scaffold Cost: one pass over the areas of the recommended level.

import type { Highlight } from "../report/highlights.js";
import type { HighlightFacts } from "./highlights.js";

/**
 * The `quiet-area`, `truck-factor-alert` and `orphaned-knowledge` findings
 * that pass their thresholds. The quiet area is the one untouched longest, at
 * least 6 months; the alert needs a repository truck factor of 1 with more than
 * one contributor; the orphaned area is the largest one flagged orphaned.
 * Areas are those of the recommended level.
 */
export const knowledgeHighlights = (
  facts: HighlightFacts,
): ReadonlyArray<Highlight> => {
  throw new Error(`not implemented: ${facts.commits.length}`);
};

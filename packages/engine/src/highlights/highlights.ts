// @scaffold Owns the report's `highlights`: gathers the findings of every family, ranks them by notability and keeps six.
// @scaffold One module per source of facts sits below it, so a new highlight kind joins one family without touching the ranking.
// @scaffold Cost: one pass over the scoped commits per family; the ranking sorts at most a few dozen findings.

import type { DateTime } from "effect";

import type { ClassifiedCommit } from "../automation/classify.js";
import type { Highlight } from "../report/highlights.js";
import type { Report } from "../report/report.js";

/** The report shows at most this many highlights. */
export const MAX_HIGHLIGHTS = 6;

/** Everything the families read; all of it is already computed by the other sections. */
export type HighlightFacts = {
  /** The scope's classified commits over the full history, newest first. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  /** The `Clock` time that "last 90 days" and anniversaries are measured against. */
  readonly now: DateTime.Utc;
  /** Whether a changed path counts toward code lines. */
  readonly isCodePath: (path: string) => boolean;
  readonly knowledge: Report["knowledge"];
  readonly contributors: Report["contributors"];
};

/**
 * The notable facts of the repository, most notable first, at most
 * `MAX_HIGHLIGHTS`. A kind appears only when its threshold is met, so a quiet
 * repository returns an empty list. Events and team facts only; no person is
 * ranked against another. Pure: the same facts give the same list.
 */
export const highlights = (facts: HighlightFacts): ReadonlyArray<Highlight> => {
  throw new Error(`not implemented: ${facts.commits.length}`);
};

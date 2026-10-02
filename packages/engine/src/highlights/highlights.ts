// Owns the report's `highlights`: gathers the findings of every family, ranks them and keeps six.
// One module per source of facts sits below it, so a new highlight kind joins one family without touching the ranking.
// Cost: one pass over the scoped commits per family; the ranking sorts at most a dozen findings.

import type { DateTime } from "effect";

import type { ClassifiedCommit } from "../automation/classify.js";
import type { Highlight } from "../report/highlights.js";
import type { Report } from "../report/report.js";
import { historyEventHighlights } from "./history-events.js";
import { knowledgeHighlights } from "./knowledge-facts.js";
import { rhythmHighlights } from "./rhythm.js";

/** The report shows at most this many highlights. */
const MAX_HIGHLIGHTS = 6;

/**
 * Notability, most notable first: a risk the team can act on, then the
 * milestones, then the records, then the habits. Fixed, so the same facts give
 * the same list.
 */
const PRIORITY: ReadonlyArray<Highlight["kind"]> = [
  "truck-factor-alert",
  "orphaned-knowledge",
  "anniversary",
  "streak",
  "busiest-day",
  "newcomers",
  "biggest-cleanup",
  "quiet-area",
  "night-owls",
  "weekend",
  "rename-record",
];

/** An area of the recommended level as the highlights read it. */
export type HighlightArea = {
  readonly path: string;
  /** A `rest` area groups small leftovers and is never named. */
  readonly kind: "package" | "directory" | "rest";
  /** The area's universe files, repository-relative. */
  readonly paths: ReadonlyArray<string>;
  readonly orphaned: boolean;
  /** Files of the area with no active expert. */
  readonly withoutActiveExpert: number;
};

/** Everything the families read; all of it is already computed by the other sections. */
export type HighlightFacts = {
  /** The scope's classified commits over the full history, newest first. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  /** The `Clock` time that "last 90 days" and anniversaries are measured against. */
  readonly now: DateTime.Utc;
  /** Whether a changed path counts toward code lines. */
  readonly isCodePath: (path: string) => boolean;
  /** The universe's size and who must leave before most of it has no expert. */
  readonly knowledge: Pick<Report["knowledge"], "files" | "truckFactor">;
  /** The areas of the recommended level; without them the quiet area and orphaned knowledge cannot be found. */
  readonly areas?: ReadonlyArray<HighlightArea>;
};

const rankOf = ({ kind }: Highlight): number => PRIORITY.indexOf(kind);

/**
 * The notable facts of the repository, most notable first, at most
 * `MAX_HIGHLIGHTS`. A kind appears only when its threshold is met, so a quiet
 * repository returns an empty list. Events and team facts only; no person is
 * ranked against another. Pure: the same facts give the same list.
 */
export const highlights = (facts: HighlightFacts): ReadonlyArray<Highlight> =>
  [
    ...knowledgeHighlights(facts),
    ...historyEventHighlights(facts),
    ...rhythmHighlights(facts),
  ]
    .toSorted((a, b) => rankOf(a) - rankOf(b))
    .slice(0, MAX_HIGHLIGHTS);

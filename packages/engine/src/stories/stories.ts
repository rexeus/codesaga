// Owns the report's `stories`: gathers the findings of every family, ranks them and keeps six.
// One module per source of facts sits below it, so a new story kind joins one family without touching the ranking.
// Cost: one pass over the scoped commits per family; the ranking sorts at most a dozen findings.

import type { DateTime } from "effect";

import type { ClassifiedCommit } from "../automation/classify.js";
import type { Report } from "../report/report.js";
import type { Story } from "../report/stories.js";
import { historyEventStories } from "./history-events.js";
import { knowledgeStories } from "./knowledge-facts.js";
import { rhythmStories } from "./rhythm.js";

/** The report shows at most this many stories. */
const MAX_STORIES = 6;

/**
 * Notability, most notable first: a risk the team can act on, then the
 * milestones, then the records, then the habits. Fixed, so the same facts give
 * the same list.
 */
const PRIORITY: ReadonlyArray<Story["kind"]> = [
  "truck-factor-alert",
  "orphaned-knowledge",
  "anniversary",
  "streak",
  "busiest-day",
  "newcomers",
  "biggest-cleanup",
  "quiet-territory",
  "night-owls",
  "weekend",
  "rename-record",
];

/** A territory of the recommended detail as the stories read it. */
export type StoryTerritory = {
  readonly path: string;
  /** An `other` territory groups small leftovers and is never named. */
  readonly kind: "package" | "folder" | "other";
  /** The territory's universe files, repository-relative. */
  readonly paths: ReadonlyArray<string>;
  readonly orphaned: boolean;
  /** Files of the territory with no active expert. */
  readonly withoutActiveExpert: number;
  /** The newest commit that touched any file of the territory, in seconds since the epoch; undefined when none is known. */
  readonly lastChangeTime: number | undefined;
};

/** Everything the families read; all of it is already computed by the other sections. */
export type StoryFacts = {
  /** The scope's classified commits over the full history, newest first. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  /** The `Clock` time that "last 90 days" and anniversaries are measured against. */
  readonly now: DateTime.Utc;
  /** A shallow clone cannot tell anniversaries and newcomers, which both read the first commits, so it has neither. */
  readonly shallow: boolean;
  /** Whether a changed path counts toward code lines. */
  readonly isCodePath: (path: string) => boolean;
  /** The universe's size and who must leave before most of it has no expert. */
  readonly knowledge: Pick<Report["knowledge"], "files" | "truckFactor">;
  /** The territories of the recommended detail; without them the quiet territory and orphaned knowledge cannot be found. */
  readonly territories?: ReadonlyArray<StoryTerritory>;
};

const rankOf = ({ kind }: Story): number => PRIORITY.indexOf(kind);

/**
 * The notable facts of the repository, most notable first, at most
 * `MAX_STORIES`. A kind appears only when its threshold is met, so a quiet
 * repository returns an empty list. Events and team facts only; no person is
 * ranked against another. Pure: the same facts give the same list.
 */
export const stories = (facts: StoryFacts): ReadonlyArray<Story> =>
  [
    ...knowledgeStories(facts),
    ...historyEventStories(facts),
    ...rhythmStories(facts),
  ]
    .toSorted((a, b) => rankOf(a) - rankOf(b))
    .slice(0, MAX_STORIES);

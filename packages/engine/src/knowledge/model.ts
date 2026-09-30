// Owns the knowledge model of one analysis: the humans and the experts of every universe file.
// Knowledge is relative to the full history and to `now`, which decides who is still active.

import { DateTime } from "effect";

import type { ClassifiedCommit } from "../automation/classify.js";
import { ACTIVE_DAYS, isActiveWithin } from "../contributors/activeness.js";
import type { Report } from "../report/report.js";
import type { InventoryFile } from "../universe/inventory.js";
import { contributionsByFile, humansOf } from "./contributions.js";
import type { Human } from "./contributions.js";
import { expertsOf } from "./experts.js";

export type KnowledgeModel = {
  readonly now: DateTime.Utc;
  /** The experts of every universe file, empty for a file without one. */
  readonly experts: ReadonlyMap<string, ReadonlyArray<Human>>;
};

export type Person = Report["knowledge"]["truckFactor"]["people"][number];

export type KnowledgeInput = {
  /** The scope's classified commits over the full history, newest first. */
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  readonly universe: ReadonlyArray<InventoryFile>;
  /** Time of the HEAD commit in seconds; recency is measured back from it. */
  readonly headTime: number;
  readonly now: DateTime.Utc;
};

/** Finds the experts of every universe file. */
export const knowledgeModel = ({
  commits,
  universe,
  headTime,
  now,
}: KnowledgeInput): KnowledgeModel => {
  const humans = humansOf(commits);
  const contributions = contributionsByFile(
    commits,
    new Set(universe.map(({ path }) => path)),
  );
  return {
    now,
    experts: new Map(
      universe.map(({ path, loc }) => [
        path,
        expertsOf(contributions.get(path) ?? [], {
          size: loc,
          headTime,
        }).flatMap((email) => humans.get(email) ?? []),
      ]),
    ),
  };
};

/** Whether the person has a commit in the `ACTIVE_DAYS` days before now. */
export const isActive = (human: Human, model: KnowledgeModel): boolean =>
  isActiveWithin(human.lastTime, model.now, ACTIVE_DAYS);

/** The report's view of a human, with the state of their involvement. */
export const personOf = (human: Human, model: KnowledgeModel): Person => ({
  name: human.name,
  email: human.email,
  active: isActive(human, model),
  lastCommitAt: DateTime.formatIso(DateTime.makeUnsafe(human.lastTime * 1000)),
});

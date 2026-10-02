// Owns gathering what the territory badge rules read, from the knowledge model and the commits.
// One pass over the commits for the facts of every territory, one for the history facts all of them share.
// Cost: every change of every commit once, a lookup per territory that holds the file, plus one lookup per universe file and expert.

import type { DateTime } from "effect";

import { isContributorCommit } from "../automation/classify.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { isActiveWithin } from "../contributors/activeness.js";
import type { Human } from "../knowledge/contributions.js";
import { isActive } from "../knowledge/model.js";
import type { KnowledgeModel } from "../knowledge/model.js";
import type { TerritoryWithFiles } from "../knowledge/territories.js";
import type { TerritoryBadgeInput } from "./territory-badge-facts.js";
import { TERRITORY_BADGE_THRESHOLDS } from "./territory-badge-thresholds.js";

const { inFocusDays } = TERRITORY_BADGE_THRESHOLDS;

/** What every territory shares: the commits, the time they are judged at and when files and people started. */
export type TerritoryHistory = {
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  /** The `Clock` time that "the last 90 days" is measured back from. */
  readonly now: DateTime.Utc;
  /** The time of each path's first commit in the life of the path. */
  readonly fileFirstCommits: ReadonlyMap<string, number>;
  /** The time of the repository's first commit; undefined in a shallow clone, which does not show it. */
  readonly startTime: number | undefined;
  /** The first commit of every contributor who arrived after the repository started, with the paths it changed. */
  readonly firstCommits: TerritoryBadgeInput["firstCommits"];
};

/**
 * The first commits of files and of people, from commits newest first. A
 * shallow clone knows neither when the repository started nor who arrived
 * after it, so it has no start time and no first commits.
 */
export const territoryHistoryOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
  now: DateTime.Utc,
  shallow: boolean,
): TerritoryHistory => {
  const fileFirstCommits = new Map<string, number>();
  const firstByPerson = new Map<
    string,
    { readonly time: number; readonly paths: ReadonlyArray<string> }
  >();
  for (const commit of commits) {
    for (const { path, previousLife } of commit.changes) {
      if (previousLife !== true) {
        fileFirstCommits.set(
          path,
          Math.min(fileFirstCommits.get(path) ?? Infinity, commit.time),
        );
      }
    }
    const before = firstByPerson.get(commit.author.email);
    if (
      isContributorCommit(commit) &&
      (before === undefined || commit.time <= before.time)
    ) {
      firstByPerson.set(commit.author.email, {
        time: commit.time,
        paths: commit.changes.map(({ path }) => path),
      });
    }
  }
  const start = commits.reduce(
    (first, { time }) => Math.min(first, time),
    Infinity,
  );
  return {
    commits,
    now,
    fileFirstCommits,
    startTime: shallow ? undefined : start,
    firstCommits: shallow
      ? []
      : [...firstByPerson.values()].filter(({ time }) => time > start),
  };
};

type TerritoryFacts = {
  lastChangeTime: number | undefined;
  recentCommits: number;
  /** When each person first committed to a file of the territory. */
  readonly personFirst: Map<string, number>;
};

/** Every territory of the tree: the last change, the recent commits and when each person arrived. */
const territoryFactsOf = (
  tree: ReadonlyArray<TerritoryWithFiles>,
  { commits, now }: TerritoryHistory,
): ReadonlyMap<TerritoryWithFiles, TerritoryFacts> => {
  const facts = new Map<TerritoryWithFiles, TerritoryFacts>();
  const factsOfPath = new Map<string, Array<TerritoryFacts>>();
  const visit = (territory: TerritoryWithFiles): void => {
    const own: TerritoryFacts = {
      lastChangeTime: undefined,
      recentCommits: 0,
      personFirst: new Map(),
    };
    facts.set(territory, own);
    for (const path of territory.paths) {
      factsOfPath.set(path, [...(factsOfPath.get(path) ?? []), own]);
    }
    for (const child of territory.territories) {
      visit(child);
    }
  };
  for (const territory of tree) {
    visit(territory);
  }
  for (const commit of commits) {
    const touched = new Set(
      commit.changes.flatMap(({ path }) => factsOfPath.get(path) ?? []),
    );
    for (const territory of touched) {
      territory.lastChangeTime = Math.max(
        territory.lastChangeTime ?? 0,
        commit.time,
      );
      if (isContributorCommit(commit)) {
        territory.recentCommits += isActiveWithin(commit.time, now, inFocusDays)
          ? 1
          : 0;
        const { email } = commit.author;
        territory.personFirst.set(
          email,
          Math.min(territory.personFirst.get(email) ?? Infinity, commit.time),
        );
      }
    }
  }
  return facts;
};

/** Every expert of the territory with the files they know, most files first, as the rules read them. */
const expertsOf = (
  territory: TerritoryWithFiles,
  model: KnowledgeModel,
  personFirst: ReadonlyMap<string, number>,
): TerritoryBadgeInput["experts"] => {
  const tallies = new Map<
    string,
    { human: Human; files: number; soleFiles: number }
  >();
  for (const path of territory.paths) {
    const experts = model.experts.get(path) ?? [];
    for (const human of experts) {
      const before = tallies.get(human.email);
      tallies.set(human.email, {
        human,
        files: (before?.files ?? 0) + 1,
        soleFiles: (before?.soleFiles ?? 0) + (experts.length === 1 ? 1 : 0),
      });
    }
  }
  return [...tallies.values()]
    .toSorted(
      (a, b) => b.files - a.files || a.human.email.localeCompare(b.human.email),
    )
    .map(({ human, files, soleFiles }) => ({
      files,
      soleFiles,
      firstTime: personFirst.get(human.email) ?? human.lastTime,
      lastTime: human.lastTime,
    }));
};

/**
 * The badge input of every territory of the tree, found by the territory itself. The
 * territory in focus is chosen among its named siblings, the territories with the
 * same parent, or the first cut: the commits of an `other` territory add up many
 * small ones and do not compete.
 */
export const territoryBadgeInputs = (
  tree: ReadonlyArray<TerritoryWithFiles>,
  history: TerritoryHistory,
  model: KnowledgeModel,
): ReadonlyMap<TerritoryWithFiles, TerritoryBadgeInput> => {
  const facts = territoryFactsOf(tree, history);
  const inputs = new Map<TerritoryWithFiles, TerritoryBadgeInput>();
  const visit = (siblings: ReadonlyArray<TerritoryWithFiles>): void => {
    for (const territory of siblings) {
      const own = facts.get(territory);
      const peers = siblings.flatMap((peer) =>
        peer === territory || peer.kind === "other"
          ? []
          : [facts.get(peer)?.recentCommits ?? 0],
      );
      inputs.set(territory, {
        kind: territory.kind,
        path: territory.path,
        paths: territory.paths,
        truckFactor: territory.truckFactor,
        island: territory.island,
        orphaned: territory.orphaned,
        experts: expertsOf(territory, model, own?.personFirst ?? new Map()),
        fileFirstCommits: territory.paths.flatMap(
          (path) => history.fileFirstCommits.get(path) ?? [],
        ),
        lastChangeTime: own?.lastChangeTime,
        recentCommits: own?.recentCommits ?? 0,
        peerRecentCommits: peers.reduce(
          (most, count) => Math.max(most, count),
          0,
        ),
        startTime: history.startTime,
        firstCommits: history.firstCommits,
      });
      visit(territory.territories);
    }
  };
  visit(tree);
  return inputs;
};

/**
 * A territory as the contributor badges and the stories read it: its files, the
 * emails of its active experts, how many files have none and when it last
 * changed, as `territoryBadgeInputs` found it.
 */
export const storyTerritoryOf = (
  territory: TerritoryWithFiles,
  model: KnowledgeModel,
  lastChangeTime: number | undefined,
) => {
  const active = new Set<string>();
  let withoutActiveExpert = 0;
  for (const path of territory.paths) {
    const activeHere = (model.experts.get(path) ?? []).filter((human) =>
      isActive(human, model),
    );
    withoutActiveExpert += activeHere.length === 0 ? 1 : 0;
    for (const { email } of activeHere) {
      active.add(email);
    }
  }
  return {
    path: territory.path,
    kind: territory.kind,
    paths: territory.paths,
    orphaned: territory.orphaned,
    withoutActiveExpert,
    activeExperts: [...active],
    lastChangeTime,
  };
};

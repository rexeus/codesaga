// Owns gathering what the area badge rules read, from the knowledge model and the commits.
// One pass over the commits per level for the area facts, one for the history facts shared by all levels.
// Cost: every change of every commit once per level, plus one lookup per universe file and expert.

import type { DateTime } from "effect";

import { isContributorCommit } from "../automation/classify.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { isActiveWithin } from "../contributors/activeness.js";
import type { AreaWithFiles } from "../knowledge/areas.js";
import type { Human } from "../knowledge/contributions.js";
import { isActive } from "../knowledge/model.js";
import type { KnowledgeModel } from "../knowledge/model.js";
import { AREA_BADGE_THRESHOLDS } from "./area-badge-thresholds.js";
import type { AreaBadgeInput } from "./area-badges.js";

const { inFocusDays } = AREA_BADGE_THRESHOLDS;

/** What every level shares: the commits, the time they are judged at and when files and people started. */
export type AreaHistory = {
  readonly commits: ReadonlyArray<ClassifiedCommit>;
  /** The `Clock` time that "the last 90 days" is measured back from. */
  readonly now: DateTime.Utc;
  /** The time of each path's first commit in the life of the path. */
  readonly fileFirstCommits: ReadonlyMap<string, number>;
  /** The time of the repository's first commit. */
  readonly startTime: number;
  /** The first commit of every contributor who arrived after the repository started, with the paths it changed. */
  readonly firstCommits: AreaBadgeInput["firstCommits"];
};

/** The first commits of files and of people, from commits newest first. */
export const areaHistoryOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
  now: DateTime.Utc,
): AreaHistory => {
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
  const startTime = commits.reduce(
    (first, { time }) => Math.min(first, time),
    Infinity,
  );
  return {
    commits,
    now,
    fileFirstCommits,
    startTime,
    firstCommits: [...firstByPerson.values()].filter(
      ({ time }) => time > startTime,
    ),
  };
};

type AreaFacts = {
  lastChangeTime: number | undefined;
  recentCommits: number;
  /** When each person first committed to a file of the area. */
  readonly personFirst: Map<string, number>;
};

/** For each area of one level, the last change, the recent commits and when each person arrived. */
const areaFactsOf = (
  areas: ReadonlyArray<AreaWithFiles>,
  { commits, now }: AreaHistory,
): ReadonlyArray<AreaFacts> => {
  const areaOfPath = new Map(
    areas.flatMap(({ paths }, index) => paths.map((path) => [path, index])),
  );
  const facts = areas.map((): AreaFacts => ({
    lastChangeTime: undefined,
    recentCommits: 0,
    personFirst: new Map(),
  }));
  for (const commit of commits) {
    const touched = new Set(
      commit.changes.flatMap(({ path }) => areaOfPath.get(path) ?? []),
    );
    for (const index of touched) {
      const area = facts[index];
      if (area === undefined) {
        continue;
      }
      area.lastChangeTime = Math.max(area.lastChangeTime ?? 0, commit.time);
      if (isContributorCommit(commit)) {
        area.recentCommits += isActiveWithin(commit.time, now, inFocusDays)
          ? 1
          : 0;
        const { email } = commit.author;
        area.personFirst.set(
          email,
          Math.min(area.personFirst.get(email) ?? Infinity, commit.time),
        );
      }
    }
  }
  return facts;
};

/** Every expert of the area with the files they know, most files first, as the rules read them. */
const expertsOf = (
  area: AreaWithFiles,
  model: KnowledgeModel,
  personFirst: ReadonlyMap<string, number>,
): AreaBadgeInput["experts"] => {
  const tallies = new Map<
    string,
    { human: Human; files: number; soleFiles: number }
  >();
  for (const path of area.paths) {
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
 * The badge input of every area of one level, in the order of `areas`. The
 * area in focus is chosen among the named areas: the commits of a `rest` area
 * add up many small ones and do not compete.
 */
export const areaBadgeInputs = (
  areas: ReadonlyArray<AreaWithFiles>,
  history: AreaHistory,
  model: KnowledgeModel,
): ReadonlyArray<AreaBadgeInput> => {
  const facts = areaFactsOf(areas, history);
  return areas.map((area, index) => {
    const own = facts[index];
    const peers = facts.flatMap((peer, other) =>
      other === index || areas[other]?.kind === "rest"
        ? []
        : [peer.recentCommits],
    );
    return {
      kind: area.kind,
      path: area.path,
      paths: area.paths,
      truckFactor: area.truckFactor,
      island: area.island,
      orphaned: area.orphaned,
      experts: expertsOf(area, model, own?.personFirst ?? new Map()),
      fileFirstCommits: area.paths.flatMap(
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
    };
  });
};

/**
 * An area as the contributor badges and the highlights read it: its files, the
 * emails of its active experts, how many files have none and when it last
 * changed, as `areaBadgeInputs` found it.
 */
export const storyAreaOf = (
  area: AreaWithFiles,
  model: KnowledgeModel,
  lastChangeTime: number | undefined,
) => {
  const active = new Set<string>();
  let withoutActiveExpert = 0;
  for (const path of area.paths) {
    const activeHere = (model.experts.get(path) ?? []).filter((human) =>
      isActive(human, model),
    );
    withoutActiveExpert += activeHere.length === 0 ? 1 : 0;
    for (const { email } of activeHere) {
      active.add(email);
    }
  }
  return {
    path: area.path,
    kind: area.kind,
    paths: area.paths,
    orphaned: area.orphaned,
    withoutActiveExpert,
    activeExperts: [...active],
    lastChangeTime,
  };
};

// Owns turning the facts analyze gathered into a Report: the sections over the prepared commits.
// Pure, so the composition is testable without git; analyze only gathers the facts.
// One pass per section over the scoped commits.

import { activity } from "../activity/activity.js";
import { punchcard } from "../activity/punchcard.js";
import { automation } from "../automation/automation.js";
import { CONTRIBUTOR_BADGE_THRESHOLDS } from "../badges/contributor-badges.js";
import { TERRITORY_BADGE_THRESHOLDS } from "../badges/territory-badge-thresholds.js";
import { comparison } from "../compare/comparison.js";
import { ACTIVE_DAYS } from "../contributors/activeness.js";
import { contributors } from "../contributors/contributors.js";
import {
  TERRITORY_THRESHOLDS,
  KNOWLEDGE_THRESHOLDS,
  knowledge,
} from "../knowledge/knowledge.js";
import { overview } from "../overview/overview.js";
import type { Report } from "../report/report.js";
import { universeStats } from "../stats/universe-stats.js";
import { stories } from "../stories/stories.js";
import type { StoryFacts } from "../stories/stories.js";
import { STORY_THRESHOLDS } from "../stories/thresholds.js";
import type { RepositoryFacts } from "./gather.js";
import { prepareAnalysis } from "./prepare.js";
import type { Analysis } from "./prepare.js";

const THRESHOLDS: Report["thresholds"] = {
  activeDays: ACTIVE_DAYS,
  ...KNOWLEDGE_THRESHOLDS,
  territories: TERRITORY_THRESHOLDS,
  stories: STORY_THRESHOLDS,
  badges: { ...TERRITORY_BADGE_THRESHOLDS, ...CONTRIBUTOR_BADGE_THRESHOLDS },
};

const storiesOf = (
  { now, isCodePath, repository }: RepositoryFacts,
  commits: Analysis["scoped"],
  knowledgeSection: Report["knowledge"],
  territories: StoryFacts["territories"],
): Report["stories"] =>
  stories({
    commits,
    now,
    shallow: repository.shallow,
    isCodePath,
    knowledge: knowledgeSection,
    ...(territories === undefined ? {} : { territories }),
  });

const comparisonField = (
  { isCodePath }: RepositoryFacts,
  current: Analysis["commits"],
  previous: Analysis["previous"],
): Pick<Report, "comparison"> =>
  previous === undefined
    ? {}
    : { comparison: comparison({ current, previous, isCodePath }) };

/** The code stats of the universe: revisions over the full history, commit habits over the window. */
const statsOf = (
  { universe, isCodePath }: RepositoryFacts,
  history: Analysis["scoped"],
  window: Analysis["commits"],
) => universeStats({ universe, history, window, isCodePath });

const knowledgeOf = (
  facts: RepositoryFacts,
  scoped: Analysis["scoped"],
  headTime: number,
  stats: ReturnType<typeof statsOf>,
) =>
  knowledge({
    commits: scoped,
    universe: facts.universe,
    stats,
    scope: facts.repository.scope,
    packageRoots: facts.packageRoots,
    detail: facts.detail,
    shallow: facts.repository.shallow,
    headTime,
    now: facts.now,
    blame: facts.blame,
    signatures: facts.signatures,
  });

/** Builds the report from the facts, each section over the commits it covers. */
export const buildReport = (facts: RepositoryFacts): Report => {
  const {
    scoped,
    commits,
    window,
    previous,
    headTime,
    firstCommitAt,
    lastCommitAt,
  } = prepareAnalysis(facts);
  const stats = statsOf(facts, scoped, commits);
  const { section: knowledgeSection, recommendedTerritories } = knowledgeOf(
    facts,
    scoped,
    headTime,
    stats,
  );
  const people = contributors({
    commits,
    history: scoped,
    scope: facts.repository.scope,
    now: facts.now,
    shallow: facts.repository.shallow,
    isCodePath: facts.isCodePath,
    universePaths: facts.universe.map(({ path }) => path),
    territories: recommendedTerritories,
  });
  return {
    schemaVersion: 1,
    tool: { name: "codesaga", version: facts.toolVersion },
    generatedAt: window.until,
    repository: { ...facts.repository, firstCommitAt, lastCommitAt },
    window: { ...window, commits: commits.length },
    thresholds: THRESHOLDS,
    totals: {
      contributors: people.length,
      directories: knowledgeSection.directories.length,
    },
    overview: overview({
      commits,
      history: scoped,
      universe: facts.universe,
      now: facts.now,
    }),
    activity: activity({ commits, window, isCodePath: facts.isCodePath }),
    punchcard: punchcard(commits),
    contributors: people,
    automation: automation({ commits, window }),
    knowledge: knowledgeSection,
    stats: stats.repository,
    stories: storiesOf(facts, scoped, knowledgeSection, recommendedTerritories),
    ...comparisonField(facts, commits, previous),
  };
};

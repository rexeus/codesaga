// Owns turning the facts analyze gathered into a Report: the sections over the prepared commits.
// Pure, so the composition is testable without git; analyze only gathers the facts.
// One pass per section over the scoped commits.

import { activity } from "../activity/activity.js";
import { punchcard } from "../activity/punchcard.js";
import { automation } from "../automation/automation.js";
import { AREA_BADGE_THRESHOLDS } from "../badges/area-badges.js";
import { CONTRIBUTOR_BADGE_THRESHOLDS } from "../badges/contributor-badges.js";
import { comparison } from "../compare/comparison.js";
import { ACTIVE_DAYS } from "../contributors/activeness.js";
import { contributors } from "../contributors/contributors.js";
import { highlights } from "../highlights/highlights.js";
import type { HighlightFacts } from "../highlights/highlights.js";
import { HIGHLIGHT_THRESHOLDS } from "../highlights/thresholds.js";
import {
  AREA_THRESHOLDS,
  KNOWLEDGE_THRESHOLDS,
  knowledge,
} from "../knowledge/knowledge.js";
import { overview } from "../overview/overview.js";
import type { Report } from "../report/report.js";
import type { RepositoryFacts } from "./gather.js";
import { prepareAnalysis } from "./prepare.js";
import type { Analysis } from "./prepare.js";

const THRESHOLDS: Report["thresholds"] = {
  activeDays: ACTIVE_DAYS,
  ...KNOWLEDGE_THRESHOLDS,
  areas: AREA_THRESHOLDS,
  highlights: HIGHLIGHT_THRESHOLDS,
  badges: { ...AREA_BADGE_THRESHOLDS, ...CONTRIBUTOR_BADGE_THRESHOLDS },
};

const highlightsOf = (
  { now, isCodePath }: RepositoryFacts,
  commits: Analysis["scoped"],
  knowledgeSection: Report["knowledge"],
  areas: HighlightFacts["areas"],
): Report["highlights"] =>
  highlights({
    commits,
    now,
    isCodePath,
    knowledge: knowledgeSection,
    ...(areas === undefined ? {} : { areas }),
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
  const { section: knowledgeSection, recommendedAreas } = knowledge({
    commits: scoped,
    universe: facts.universe,
    scope: facts.repository.scope,
    packageRoots: facts.packageRoots,
    window,
    depth: facts.depth,
    headTime,
    now: facts.now,
    blame: facts.blame,
    signatures: facts.signatures,
  });
  const people = contributors({
    commits,
    history: scoped,
    scope: facts.repository.scope,
    now: facts.now,
    isCodePath: facts.isCodePath,
    universePaths: facts.universe.map(({ path }) => path),
    areas: recommendedAreas,
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
    overview: overview({ commits, universe: facts.universe, now: facts.now }),
    activity: activity({ commits, window, isCodePath: facts.isCodePath }),
    punchcard: punchcard(commits),
    contributors: people,
    automation: automation({ commits, window }),
    knowledge: knowledgeSection,
    highlights: highlightsOf(facts, scoped, knowledgeSection, recommendedAreas),
    ...(previous === undefined
      ? {}
      : {
          comparison: comparison({
            current: commits,
            previous,
            isCodePath: facts.isCodePath,
          }),
        }),
  };
};

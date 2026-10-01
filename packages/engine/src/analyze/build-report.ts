// Owns turning the facts analyze gathered into a Report: the sections over the prepared commits.
// Pure, so the composition is testable without git; analyze only gathers the facts.
// One pass per section over the scoped commits.

import { activity } from "../activity/activity.js";
import { punchcard } from "../activity/punchcard.js";
import { automation } from "../automation/automation.js";
import { comparison } from "../compare/comparison.js";
import { ACTIVE_DAYS } from "../contributors/activeness.js";
import { contributors } from "../contributors/contributors.js";
import { KNOWLEDGE_THRESHOLDS, knowledge } from "../knowledge/knowledge.js";
import { overview } from "../overview/overview.js";
import type { Report } from "../report/report.js";
import type { RepositoryFacts } from "./gather.js";
import { prepareAnalysis } from "./prepare.js";

/** Builds the report from the facts, each section over the commits it covers. */
export const buildReport = (facts: RepositoryFacts): Report => {
  const { scope } = facts.repository;
  const {
    scoped,
    commits,
    window,
    previous,
    headTime,
    firstCommitAt,
    lastCommitAt,
  } = prepareAnalysis(facts);
  const knowledgeSection = knowledge({
    commits: scoped,
    universe: facts.universe,
    scope,
    headTime,
    now: facts.now,
    blame: facts.blame,
    signatures: facts.signatures,
  });
  const people = contributors({
    commits,
    scope,
    now: facts.now,
    isCodePath: facts.isCodePath,
  });
  return {
    schemaVersion: 1,
    tool: { name: "codesaga", version: facts.toolVersion },
    generatedAt: window.until,
    repository: { ...facts.repository, firstCommitAt, lastCommitAt },
    window: { ...window, commits: commits.length },
    thresholds: { activeDays: ACTIVE_DAYS, ...KNOWLEDGE_THRESHOLDS },
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

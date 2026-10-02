// Owns the craft badges: tidier, tester, documenter and toolsmith, which read what a person's commits change.
// Apart from `contributor-badges.ts` because they judge changed paths, by kind, rather than territories or times.
// Cost: a pass over the contributor's commits per rule.
import type { ClassifiedCommit } from "../automation/classify.js";
import { isActiveWithin } from "../contributors/activeness.js";
import { countCodeLines } from "../history/history.js";
import { countOf, percentOf } from "../report/sentences.js";
import {
  isDocPath,
  isTestPath,
  isToolingPath,
} from "../universe/path-kinds.js";
import type { BadgeContext } from "./contributor-badge-facts.js";
import { CONTRIBUTOR_BADGE_THRESHOLDS } from "./contributor-badge-thresholds.js";

const {
  tidierNetDeletedLines,
  testerShare,
  documenterShare,
  minCommitsForShare,
  recentWindowDays,
  toolsmithShare,
  toolsmithMinCommits,
} = CONTRIBUTOR_BADGE_THRESHOLDS;

export const tidier = ({ commits, isCodePath }: BadgeContext) => {
  const { added, deleted } = countCodeLines(commits, isCodePath);
  return deleted - added >= tidierNetDeletedLines
    ? {
        kind: "tidier" as const,
        label: "Tidier",
        evidence: `Removed ${deleted - added} more code lines than added.`,
      }
    : undefined;
};

export const tester = ({ commits }: BadgeContext) => {
  const paths = new Set(
    commits.flatMap(({ changes }) => changes.map(({ path }) => path)),
  );
  const tests = [...paths].filter((path) => isTestPath(path)).length;
  return commits.length >= minCommitsForShare &&
    tests / paths.size >= testerShare
    ? {
        kind: "tester" as const,
        label: "Tester",
        evidence: `${percentOf(tests / paths.size)} of the changed files are tests.`,
      }
    : undefined;
};

export const documenter = ({ commits }: BadgeContext) => {
  const documenting = commits.filter(({ changes }) =>
    changes.some(({ path }) => isDocPath(path)),
  ).length;
  return commits.length >= minCommitsForShare &&
    documenting / commits.length >= documenterShare
    ? {
        kind: "documenter" as const,
        label: "Documenter",
        evidence: `${percentOf(documenting / commits.length)} of the commits touch documentation.`,
      }
    : undefined;
};

const touchesOnlyTooling = ({ changes }: ClassifiedCommit): boolean =>
  changes.every(({ path }) => isToolingPath(path));

/**
 * At least `toolsmithShare` of the person's human commits of the last
 * `recentWindowDays` days change only tooling files, from `toolsmithMinCommits`
 * commits that change anything. Agent-assisted commits are the agent's work.
 */
export const toolsmith = ({ commits, now }: BadgeContext) => {
  const own = commits.filter(
    ({ class: commitClass, time, changes }) =>
      commitClass === "human" &&
      isActiveWithin(time, now, recentWindowDays) &&
      changes.length > 0,
  );
  const tooling = own.filter((commit) => touchesOnlyTooling(commit)).length;
  return own.length >= toolsmithMinCommits &&
    tooling / own.length >= toolsmithShare
    ? {
        kind: "toolsmith" as const,
        label: "Toolsmith",
        evidence: `${percentOf(tooling / own.length)} of their commits in the last year change only tooling files, such as CI, containers, manifests and configuration (${countOf(tooling)} of ${countOf(own.length)}).`,
      }
    : undefined;
};

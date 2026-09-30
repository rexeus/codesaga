// Owns turning the gathered facts into an InspectResult: one aggregated entry per argument.
// An argument matches a universe file when it names the file, a directory above it, or a glob matching either.
// Pure, so the matching and the aggregation are testable without git.

import { DateTime } from "effect";

import type { RepositoryFacts } from "../analyze/gather.js";
import { prepareAnalysis } from "../analyze/prepare.js";
import type { Analysis } from "../analyze/prepare.js";
import { totalsOf } from "../automation/automation.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { describeFileSet } from "../knowledge/file-set.js";
import { knowledgeModel } from "../knowledge/model.js";
import type { KnowledgeModel } from "../knowledge/model.js";
import type { InspectResult } from "../report/inspect-result.js";
import { ancestorsOf } from "../universe/ancestors.js";
import { matchesAny } from "../universe/globs.js";
import { automationReasons } from "./automation-reasons.js";

type Entry = InspectResult["matches"][number];

const isoOf = (seconds: number): string =>
  DateTime.formatIso(DateTime.makeUnsafe(seconds * 1000));

/**
 * The paths an argument matches: the file itself, files below a matching
 * directory, and every file when the argument names the repository root
 * (`.`, `./`, `/` or an empty string).
 */
const pathsMatching = (
  pattern: string,
  paths: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const target = pattern.replace(/\/+$/u, "");
  if (target === "" || target === ".") {
    return paths;
  }
  const matches = matchesAny([target]);
  return paths.filter((path) =>
    [path, ...ancestorsOf(path)].some((candidate) => matches(candidate)),
  );
};

const entryOf = (
  pattern: string,
  paths: ReadonlyArray<string>,
  model: KnowledgeModel,
  windowed: ReadonlyArray<ClassifiedCommit>,
): Entry => {
  const set = describeFileSet(paths, model);
  const matched = new Set(paths);
  const touching = windowed.filter(({ changes }) =>
    changes.some(({ path }) => matched.has(path)),
  );
  const last = Math.max(...touching.map(({ time }) => time));
  return {
    pattern,
    files: set.files,
    truckFactor: set.truckFactor.length,
    island: set.island,
    orphaned: set.orphaned,
    experts: set.experts,
    commits: touching.length,
    lastCommitAt: touching.length === 0 ? null : isoOf(last),
    automation: totalsOf(touching),
    reasons: [...set.reasons, ...automationReasons(touching)],
  };
};

const resultOf = (
  analysis: Analysis,
  entries: ReadonlyArray<Entry | string>,
): InspectResult => ({
  schemaVersion: 1,
  window: { ...analysis.window, commits: analysis.commits.length },
  matches: entries.filter((entry) => typeof entry !== "string"),
  unmatched: entries.filter((entry) => typeof entry === "string"),
});

/**
 * Answers every pattern from the facts: who knows the files it matches (over
 * the whole history) and how much recent work, by class, went into them (over
 * the window). A pattern that matches no universe file is listed as unmatched.
 */
export const buildInspectResult = (
  facts: RepositoryFacts,
  patterns: ReadonlyArray<string>,
): InspectResult => {
  const analysis = prepareAnalysis(facts);
  const model = knowledgeModel({
    commits: analysis.scoped,
    universe: facts.universe,
    headTime: analysis.headTime,
    now: facts.now,
  });
  const paths = facts.universe.map(({ path }) => path);
  return resultOf(
    analysis,
    patterns.map((pattern) => {
      const matched = pathsMatching(pattern, paths);
      return matched.length === 0
        ? pattern
        : entryOf(pattern, matched, model, analysis.commits);
    }),
  );
};

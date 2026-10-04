// Owns turning the gathered facts into an InspectResult: one aggregated entry per argument.
// An argument matches a universe file when it names the file, a directory above it, or a glob matching either.
// Pure, so the matching and the aggregation are testable without git.

import { isoOfEpochSeconds } from "../analyze/analysis-window.js";
import type { RepositoryFacts } from "../analyze/gather.js";
import { prepareAnalysis } from "../analyze/prepare.js";
import type { Analysis } from "../analyze/prepare.js";
import { totalsOf } from "../automation/automation.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import { lineOwnersField, lineOwnersOf } from "../blame/line-owners.js";
import type { LineOwners } from "../blame/line-owners.js";
import { describeFileSet } from "../knowledge/file-set.js";
import { knowledgeModel } from "../knowledge/model.js";
import type { KnowledgeModel } from "../knowledge/model.js";
import type { InspectResult } from "../report/inspect-result.js";
import { inspectTypeScriptOf } from "../typescript/inspect/inspected-files.js";
import type { InspectedTypeScript } from "../typescript/inspect/inspected-files.js";
import { automationReasons } from "./automation-reasons.js";
import { pathsMatching } from "./match-paths.js";

type Entry = InspectResult["matches"][number];

/** What every entry reads besides its own paths. */
type Context = {
  readonly model: KnowledgeModel;
  /** The commits of the window, newest first. */
  readonly windowed: ReadonlyArray<ClassifiedCommit>;
  readonly typescript: InspectedTypeScript | undefined;
};

const entryOf = (
  pattern: string,
  paths: ReadonlyArray<string>,
  { model, windowed, typescript }: Context,
): Entry => {
  const set = describeFileSet(paths, model);
  const matched = new Set(paths);
  const touching = windowed.filter(({ changes }) =>
    changes.some(({ path }) => matched.has(path)),
  );
  const last = touching.reduce(
    (max, { time }) => Math.max(max, time),
    -Infinity,
  );
  const code =
    typescript === undefined
      ? undefined
      : inspectTypeScriptOf(typescript, paths);
  return {
    pattern,
    files: set.files,
    truckFactor: set.truckFactor.length,
    island: set.island,
    orphaned: set.orphaned,
    experts: set.experts,
    ...lineOwnersField(set.lineOwners),
    commits: touching.length,
    lastCommitAt: touching.length === 0 ? null : isoOfEpochSeconds(last),
    automation: totalsOf(touching),
    ...(code === undefined ? {} : { typescript: code }),
    reasons: [...set.reasons, ...automationReasons(touching)],
  };
};

const resultOf = (
  analysis: Analysis,
  shallow: boolean,
  entries: ReadonlyArray<Entry | string>,
  lineOwners: LineOwners | undefined,
): InspectResult => ({
  schemaVersion: 1,
  shallow,
  window: { ...analysis.window, commits: analysis.commits.length },
  matches: entries.filter((entry) => typeof entry !== "string"),
  unmatched: entries.filter((entry) => typeof entry === "string"),
  ...lineOwnersField(lineOwners),
});

/**
 * Answers every pattern from the facts: who knows the files it matches (over
 * the whole history) and how much recent work, by class, went into them (over
 * the window). A pattern that matches no universe file is listed as unmatched.
 * `typescript` is what the gathering read of the matched TypeScript and
 * JavaScript files, and absent without any.
 */
export const buildInspectResult = (
  facts: RepositoryFacts,
  patterns: ReadonlyArray<string>,
  typescript?: InspectedTypeScript,
): InspectResult => {
  const analysis = prepareAnalysis(facts);
  const model = knowledgeModel({
    commits: analysis.scoped,
    universe: facts.universe,
    headTime: analysis.headTime,
    now: facts.now,
    blame: facts.blame,
    signatures: facts.signatures,
  });
  const paths = facts.universe.map(({ path }) => path);
  const matches = patterns.map((pattern) => ({
    pattern,
    paths: pathsMatching(pattern, paths),
  }));
  const matchedPaths = [...new Set(matches.flatMap((match) => match.paths))];
  return resultOf(
    analysis,
    facts.repository.shallow,
    matches.map(({ pattern, paths: matched }) =>
      matched.length === 0
        ? pattern
        : entryOf(pattern, matched, {
            model,
            windowed: analysis.commits,
            typescript,
          }),
    ),
    model.ownership === undefined || matchedPaths.length === 0
      ? undefined
      : lineOwnersOf(matchedPaths, model.ownership),
  );
};

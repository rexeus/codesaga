// Owns turning the facts analyze gathered into a Report: the sections over the prepared commits.
// Pure, so the composition is testable without git; analyze only gathers the facts.
// One pass per section over the scoped commits.

import { achievements } from "../achievements/achievements.js";
import { activity } from "../activity/activity.js";
import { punchcard } from "../activity/punchcard.js";
import { automation } from "../automation/automation.js";
import { comparison } from "../compare/comparison.js";
import { contributors } from "../contributors/contributors.js";
import { knowledge } from "../knowledge/knowledge.js";
import { overview } from "../overview/overview.js";
import type { Report } from "../report/report.js";
import type { Imports } from "../report/typescript-imports.js";
import { universeStats } from "../stats/universe-stats.js";
import { stories } from "../stories/stories.js";
import type { StoryFacts } from "../stories/stories.js";
import { typescriptAnalysis } from "../typescript/deep-dive.js";
import type { TypeScriptAnalysis } from "../typescript/deep-dive.js";
import type { HistoryFacts } from "../typescript/history-facts.js";
import type { RepositoryFacts } from "./gather.js";
import { prepareAnalysis } from "./prepare.js";
import type { Analysis } from "./prepare.js";
import { THRESHOLDS } from "./report-thresholds.js";

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

const achievementsOf = (
  { now, isCodePath, repository }: RepositoryFacts,
  commits: Analysis["scoped"],
  stats: Report["stats"],
  knowledgeSection: Report["knowledge"],
): Report["achievements"] =>
  achievements({
    commits,
    now,
    shallow: repository.shallow,
    isCodePath,
    stats,
    truckFactor: knowledgeSection.truckFactor.value,
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
  measured: {
    readonly stats: ReturnType<typeof statsOf>;
    readonly typescript: TypeScriptAnalysis | undefined;
  },
) =>
  knowledge({
    typescriptOf: measured.typescript?.forPaths,
    importsAt: measured.typescript?.imports?.at,
    commits: scoped,
    universe: facts.universe,
    stats: measured.stats,
    scope: facts.repository.scope,
    packageRoots: facts.packageRoots,
    detail: facts.detail,
    shallow: facts.repository.shallow,
    headTime,
    now: facts.now,
    blame: facts.blame,
    signatures: facts.signatures,
  });

const deepDivesField = (
  typescript: TypeScriptAnalysis | undefined,
  imports: Imports | undefined,
): Pick<Report, "deepDives"> =>
  typescript === undefined
    ? {}
    : {
        deepDives: {
          typescript: {
            ...typescript.section,
            ...(imports === undefined ? {} : { imports }),
          },
        },
      };

const peopleOf = (
  facts: RepositoryFacts,
  { commits, scoped }: Pick<Analysis, "commits" | "scoped">,
  territories: Parameters<typeof contributors>[0]["territories"],
) =>
  contributors({
    commits,
    history: scoped,
    scope: facts.repository.scope,
    now: facts.now,
    shallow: facts.repository.shallow,
    isCodePath: facts.isCodePath,
    universePaths: facts.universe.map(({ path }) => path),
    territories,
  });

const typescriptOf = (
  { typescript, repository }: RepositoryFacts,
  revisions: ReadonlyMap<string, number>,
): TypeScriptAnalysis | undefined =>
  typescript === undefined
    ? undefined
    : typescriptAnalysis(typescript, revisions, repository.shallow);

/** The sections that exist only for some runs or some repositories. */
const optionalSections = (
  facts: RepositoryFacts,
  current: Analysis["commits"],
  previous: Analysis["previous"],
  deepDives: Pick<Report, "deepDives">,
): Pick<Report, "comparison" | "deepDives"> => ({
  ...comparisonField(facts, current, previous),
  ...deepDives,
});

/** The facts, and the parse of every historical TypeScript and JavaScript blob, which only `analyze` gathers. */
type ReportFacts = RepositoryFacts & {
  readonly historyFacts?: HistoryFacts | undefined;
};

/** Builds the report from the facts, each section over the commits it covers. */
export const buildReport = (facts: ReportFacts): Report => {
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
  const typescript = typescriptOf(facts, stats.revisions);
  const {
    section: knowledgeSection,
    recommendedTerritories,
    imports,
  } = knowledgeOf(facts, scoped, headTime, { stats, typescript });
  const people = peopleOf(facts, { commits, scoped }, recommendedTerritories);
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
    achievements: achievementsOf(
      facts,
      scoped,
      stats.repository,
      knowledgeSection,
    ),
    ...optionalSections(
      facts,
      commits,
      previous,
      deepDivesField(typescript, imports),
    ),
  };
};

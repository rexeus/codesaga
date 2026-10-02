// Owns the knowledge section: experts, truck factor, islands and orphaned directories.
// Composes the model and the set and directory descriptions over the full history of the scope.
// One pass over the commits, then one per reported directory.

import { isoOfEpochSeconds } from "../analyze/analysis-window.js";
import {
  territoryBadgeInputs,
  territoryHistoryOf,
  storyTerritoryOf,
} from "../badges/territory-badge-inputs.js";
import { territoryBadges } from "../badges/territory-badges.js";
import { lineOwnersField } from "../blame/line-owners.js";
import { isActiveWithin } from "../contributors/activeness.js";
import { countContributors } from "../contributors/count-contributors.js";
import type { Territory } from "../report/knowledge-report.js";
import type { Report } from "../report/report.js";
import { MIN_DIRECTORY_FILES, directoryKnowledge } from "./directories.js";
import { EXPERT_RATIO } from "./doe.js";
import { ISLAND_SHARE, ORPHANED_SHARE, describeFileSet } from "./file-set.js";
import { knowledgeModel } from "./model.js";
import type { KnowledgeInput, KnowledgeModel } from "./model.js";
import {
  TERRITORIES_PER_CONTRIBUTOR,
  MAX_TARGET_TERRITORIES,
  MIN_TARGET_TERRITORIES,
  RECOMMENDATION_ACTIVE_DAYS,
  recommendDetail,
} from "./recommended-detail.js";
import { territoriesAtDetail, territoryTree } from "./territories.js";
import type { TerritoryTree, TerritoryWithFiles } from "./territories.js";
import { MAX_DETAIL } from "./territory-partition.js";
import {
  BIG_FILES_SHARE,
  BIG_MAX_FILES,
  BIG_MIN_FILES,
  BIG_SHARE,
  MAIN_EXPERT_SHARE,
  TERRITORY_MIN_FILES,
} from "./territory-tree.js";

/** The knowledge constants, for the report's `thresholds`. */
export const KNOWLEDGE_THRESHOLDS = {
  expertRatio: EXPERT_RATIO,
  minDirectoryFiles: MIN_DIRECTORY_FILES,
  islandShare: ISLAND_SHARE,
  orphanedShare: ORPHANED_SHARE,
};

/** How the territories are cut and recommended, for the report's `thresholds.territories`. */
export const TERRITORY_THRESHOLDS = {
  minFiles: TERRITORY_MIN_FILES,
  maxDetail: MAX_DETAIL,
  bigShare: BIG_SHARE,
  bigFilesShare: BIG_FILES_SHARE,
  bigMinFiles: BIG_MIN_FILES,
  bigMaxFiles: BIG_MAX_FILES,
  mainExpertShare: MAIN_EXPERT_SHARE,
  recommendationActiveDays: RECOMMENDATION_ACTIVE_DAYS,
  territoriesPerContributor: TERRITORIES_PER_CONTRIBUTOR,
  minTargetTerritories: MIN_TARGET_TERRITORIES,
  maxTargetTerritories: MAX_TARGET_TERRITORIES,
};

type KnowledgeFacts = KnowledgeInput & {
  /** Repository-relative scope; "." for the whole repository. */
  readonly scope: string;
  /** The directories of the scope that hold a package manifest, from `packageRootsOf`. */
  readonly packageRoots: ReadonlyArray<string>;
  /** A shallow clone cannot tell when a territory was created or who arrived, so it has no `new-territory` or `newcomer-friendly` badge. */
  readonly shallow: boolean;
  /** The detail to start at, from 1, rounded down; a detail beyond the deepest one means the deepest. The recommended detail when absent, not finite or below 1. */
  readonly detail?: number | undefined;
};

/** The requested detail rounded down; the recommended one when it is absent, not finite or below 1. */
const startDetail = (
  requested: number | undefined,
  recommended: number,
): number =>
  requested !== undefined && Number.isFinite(requested) && requested >= 1
    ? Math.floor(requested)
    : recommended;

type TerritoriesResult = {
  readonly section: NonNullable<Report["knowledge"]["territories"]>;
  /** The territories of the recommended detail with their files and experts, for the contributor badges and the stories. */
  readonly recommended: ReadonlyArray<ReturnType<typeof storyTerritoryOf>>;
};

/** The detail that suits the team: as deep as expertise keeps changing, within the territories its active contributors allow. */
const recommendationFor = (facts: KnowledgeFacts, tree: TerritoryTree) =>
  recommendDetail({
    details: Array.from({ length: tree.maxDetail }, (_, index) => ({
      detail: index + 1,
      viableTerritories: territoriesAtDetail(
        tree.territories,
        index + 1,
      ).filter(({ kind }) => kind !== "other").length,
    })),
    expertiseDetail: tree.expertiseDetail,
    activeContributors: countContributors(
      facts.commits.filter(({ time }) =>
        isActiveWithin(time, facts.now, RECOMMENDATION_ACTIVE_DAYS),
      ),
    ),
    historyContributors: countContributors(facts.commits),
  });

type BadgeInputs = ReturnType<typeof territoryBadgeInputs>;

/** The report's territory: the described one with its date and badges, and its children the same. */
const reportedTerritory = (
  source: TerritoryWithFiles,
  inputs: BadgeInputs,
  facts: KnowledgeFacts,
): Territory => {
  const { paths: _paths, territories, ...territory } = source;
  const input = inputs.get(source);
  return {
    ...territory,
    lastChangedAt: isoOfEpochSeconds(input?.lastChangeTime ?? facts.headTime),
    badges: input === undefined ? [] : territoryBadges(input, facts.now),
    territories: territories.map((child) =>
      reportedTerritory(child, inputs, facts),
    ),
  };
};

const territoriesSection = (
  facts: KnowledgeFacts,
  model: KnowledgeModel,
): TerritoriesResult => {
  const tree = territoryTree({
    paths: facts.universe.map(({ path }) => path),
    packageRoots: facts.packageRoots,
    scope: facts.scope,
    model,
  });
  const { detail: recommendedDetail, reason } = recommendationFor(facts, tree);
  const history = territoryHistoryOf(facts.commits, facts.now, facts.shallow);
  const inputs = territoryBadgeInputs(tree.territories, history, model);
  return {
    section: {
      detail: Math.min(
        startDetail(facts.detail, recommendedDetail),
        tree.maxDetail,
      ),
      recommendedDetail,
      maxDetail: tree.maxDetail,
      reason,
      totalTerritories: tree.territories.length,
      territories: tree.territories.map((territory) =>
        reportedTerritory(territory, inputs, facts),
      ),
    },
    recommended: territoriesAtDetail(tree.territories, recommendedDetail).map(
      (territory) =>
        storyTerritoryOf(
          territory,
          model,
          inputs.get(territory)?.lastChangeTime,
        ),
    ),
  };
};

/** The report's knowledge section and the facts about the recommended territories the other sections read. */
type KnowledgeResult = {
  readonly section: Report["knowledge"];
  readonly recommendedTerritories: TerritoriesResult["recommended"];
};

/**
 * Finds who knows the universe files and whether they are still around.
 *
 * `commits` are the classified commits of the scope over the full history,
 * newest first, independent of the activity window; `universe` is the scope's
 * files. Only humans are experts. Returns every directory and every territory of
 * every detail, each territory with its badges; truncating for output belongs to
 * the caller. `recommendedTerritories` serve the contributor badges and stories.
 */
export const knowledge = (facts: KnowledgeFacts): KnowledgeResult => {
  const model = knowledgeModel(facts);
  const paths = facts.universe.map(({ path }) => path);
  const repository = describeFileSet(paths, model);
  const territories = territoriesSection(facts, model);
  return {
    section: {
      files: repository.files,
      withoutExpert: repository.withoutExpert,
      withoutActiveExpert: repository.withoutActiveExpert,
      truckFactor: {
        value: repository.truckFactor.length,
        people: repository.truckFactor,
      },
      directories: directoryKnowledge(paths, facts.scope, model),
      territories: territories.section,
      ...lineOwnersField(repository.lineOwners),
    },
    recommendedTerritories: territories.recommended,
  };
};

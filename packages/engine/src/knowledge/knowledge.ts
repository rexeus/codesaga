// Owns the knowledge section: experts, truck factor, islands and orphaned directories.
// Composes the model and the set and directory descriptions over the full history of the scope.
// One pass over the commits, then one per reported directory.

import { Array as Arr } from "effect";

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
import { territoryDetails } from "./territories.js";
import { MAX_DETAIL } from "./territory-partition.js";
import {
  TERRITORY_MIN_FILES,
  GIANT_TERRITORY_SHARE,
  GIANT_SPLIT_STEPS,
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
  giantShare: GIANT_TERRITORY_SHARE,
  giantSplitSteps: GIANT_SPLIT_STEPS,
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

/** The detail that suits the team: territories per contributor active in the recommendation window. */
const recommendationFor = (
  facts: KnowledgeFacts,
  details: ReturnType<typeof territoryDetails>,
) =>
  recommendDetail({
    details: details.map(({ detail, territories }) => ({
      detail,
      viableTerritories: territories.filter(({ kind }) => kind !== "other")
        .length,
    })),
    activeContributors: countContributors(
      facts.commits.filter(({ time }) =>
        isActiveWithin(time, facts.now, RECOMMENDATION_ACTIVE_DAYS),
      ),
    ),
    historyContributors: countContributors(facts.commits),
  });

const territoriesSection = (
  facts: KnowledgeFacts,
  model: KnowledgeModel,
): TerritoriesResult => {
  const details = territoryDetails({
    paths: facts.universe.map(({ path }) => path),
    packageRoots: facts.packageRoots,
    scope: facts.scope,
    model,
  });
  const { detail: recommendedDetail, reason } = recommendationFor(
    facts,
    details,
  );
  const history = territoryHistoryOf(facts.commits, facts.now, facts.shallow);
  const inputs = details.map(({ territories }) =>
    territoryBadgeInputs(territories, history, model),
  );
  return {
    section: {
      detail: Math.min(
        startDetail(facts.detail, recommendedDetail),
        details.length,
      ),
      recommendedDetail,
      reason,
      details: Arr.map(
        details,
        ({ detail, totalTerritories, territories }, step) => ({
          detail,
          totalTerritories,
          territories: territories.map(
            ({ paths: _paths, ...territory }, index) => {
              const input = inputs[step]?.[index];
              return {
                ...territory,
                lastChangedAt: isoOfEpochSeconds(
                  input?.lastChangeTime ?? facts.headTime,
                ),
                badges:
                  input === undefined ? [] : territoryBadges(input, facts.now),
              };
            },
          ),
        }),
      ),
    },
    recommended: (details[recommendedDetail - 1]?.territories ?? []).map(
      (territory, index) =>
        storyTerritoryOf(
          territory,
          model,
          inputs[recommendedDetail - 1]?.[index]?.lastChangeTime,
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

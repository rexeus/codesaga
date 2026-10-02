// Owns the knowledge section: experts, truck factor, islands and orphaned directories.
// Composes the model and the set and directory descriptions over the full history of the scope.
// One pass over the commits, then one per reported directory.

import { Array as Arr } from "effect";

import { isoOfEpochSeconds } from "../analyze/analysis-window.js";
import type { TimeRange } from "../analyze/analysis-window.js";
import {
  areaBadgeInputs,
  areaHistoryOf,
  storyAreaOf,
} from "../badges/area-badge-inputs.js";
import { areaBadges } from "../badges/area-badges.js";
import { lineOwnersField } from "../blame/line-owners.js";
import { isActiveWithin } from "../contributors/activeness.js";
import { countContributors } from "../contributors/count-contributors.js";
import type { Report } from "../report/report.js";
import { MAX_AREA_DEPTH } from "./area-partition.js";
import {
  AREA_MIN_FILES,
  GIANT_AREA_SHARE,
  GIANT_SPLIT_STEPS,
} from "./area-tree.js";
import { areaLevels } from "./areas.js";
import { MIN_DIRECTORY_FILES, directoryKnowledge } from "./directories.js";
import { EXPERT_RATIO } from "./doe.js";
import { ISLAND_SHARE, ORPHANED_SHARE, describeFileSet } from "./file-set.js";
import { knowledgeModel } from "./model.js";
import type { KnowledgeInput, KnowledgeModel } from "./model.js";
import {
  AREAS_PER_CONTRIBUTOR,
  MAX_TARGET_AREAS,
  MIN_TARGET_AREAS,
  RECOMMENDATION_ACTIVE_DAYS,
  recommendDepth,
} from "./recommended-depth.js";

/** The knowledge constants, for the report's `thresholds`. */
export const KNOWLEDGE_THRESHOLDS = {
  expertRatio: EXPERT_RATIO,
  minDirectoryFiles: MIN_DIRECTORY_FILES,
  islandShare: ISLAND_SHARE,
  orphanedShare: ORPHANED_SHARE,
};

/** How the areas are cut and recommended, for the report's `thresholds.areas`. */
export const AREA_THRESHOLDS = {
  minFiles: AREA_MIN_FILES,
  maxDepth: MAX_AREA_DEPTH,
  giantShare: GIANT_AREA_SHARE,
  giantSplitSteps: GIANT_SPLIT_STEPS,
  recommendationActiveDays: RECOMMENDATION_ACTIVE_DAYS,
  areasPerContributor: AREAS_PER_CONTRIBUTOR,
  minTargetAreas: MIN_TARGET_AREAS,
  maxTargetAreas: MAX_TARGET_AREAS,
};

type KnowledgeFacts = KnowledgeInput & {
  /** Repository-relative scope; "." for the whole repository. */
  readonly scope: string;
  /** The directories of the scope that hold a package manifest, from `packageRootsOf`. */
  readonly packageRoots: ReadonlyArray<string>;
  /** The activity window, which decides the area in focus. */
  readonly window: TimeRange;
  /** The level to start at, from 1, rounded down; a level beyond the deepest one means the deepest. The recommended level when absent, not finite or below 1. */
  readonly depth?: number | undefined;
};

/** The requested level rounded down; the recommended one when it is absent, not finite or below 1. */
const startDepth = (
  requested: number | undefined,
  recommended: number,
): number =>
  requested !== undefined && Number.isFinite(requested) && requested >= 1
    ? Math.floor(requested)
    : recommended;

type AreasResult = {
  readonly section: NonNullable<Report["knowledge"]["areas"]>;
  /** The areas of the recommended level with their files and experts, for the contributor badges and the highlights. */
  readonly recommended: ReadonlyArray<ReturnType<typeof storyAreaOf>>;
};

const areasSection = (
  facts: KnowledgeFacts,
  model: KnowledgeModel,
): AreasResult => {
  const levels = areaLevels({
    paths: facts.universe.map(({ path }) => path),
    packageRoots: facts.packageRoots,
    scope: facts.scope,
    model,
  });
  const { depth: recommendedDepth, reason } = recommendDepth({
    levels: levels.map(({ depth, areas }) => ({
      depth,
      viableAreas: areas.filter(({ kind }) => kind !== "rest").length,
    })),
    activeContributors: countContributors(
      facts.commits.filter(({ time }) =>
        isActiveWithin(time, facts.now, RECOMMENDATION_ACTIVE_DAYS),
      ),
    ),
    historyContributors: countContributors(facts.commits),
  });
  const history = areaHistoryOf(facts.commits, facts.window);
  const inputs = levels.map(({ areas }) =>
    areaBadgeInputs(areas, history, model),
  );
  return {
    section: {
      depth: Math.min(startDepth(facts.depth, recommendedDepth), levels.length),
      recommendedDepth,
      reason,
      levels: Arr.map(levels, ({ depth, totalAreas, areas }, level) => ({
        depth,
        totalAreas,
        areas: areas.map(({ paths: _paths, ...area }, index) => {
          const input = inputs[level]?.[index];
          return {
            ...area,
            lastChangedAt: isoOfEpochSeconds(
              input?.lastChangeTime ?? facts.headTime,
            ),
            badges: input === undefined ? [] : areaBadges(input, facts.now),
          };
        }),
      })),
    },
    recommended: (levels[recommendedDepth - 1]?.areas ?? []).map(
      (area, index) =>
        storyAreaOf(
          area,
          model,
          inputs[recommendedDepth - 1]?.[index]?.lastChangeTime,
        ),
    ),
  };
};

/** The report's knowledge section and the facts about the recommended areas the other sections read. */
type KnowledgeResult = {
  readonly section: Report["knowledge"];
  readonly recommendedAreas: AreasResult["recommended"];
};

/**
 * Finds who knows the universe files and whether they are still around.
 *
 * `commits` are the classified commits of the scope over the full history,
 * newest first, independent of the activity window; `universe` is the scope's
 * files. Only humans are experts. Returns every directory and every area of
 * every level, each area with its badges; truncating for output belongs to
 * the caller. `recommendedAreas` serve the contributor badges and highlights.
 */
export const knowledge = (facts: KnowledgeFacts): KnowledgeResult => {
  const model = knowledgeModel(facts);
  const paths = facts.universe.map(({ path }) => path);
  const repository = describeFileSet(paths, model);
  const areas = areasSection(facts, model);
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
      areas: areas.section,
      ...lineOwnersField(repository.lineOwners),
    },
    recommendedAreas: areas.recommended,
  };
};

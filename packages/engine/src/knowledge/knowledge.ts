// Owns the knowledge section: experts, truck factor, islands and orphaned directories.
// Composes the model and the set and directory descriptions over the full history of the scope.
// One pass over the commits, then one per reported directory.

import { lineOwnersField } from "../blame/line-owners.js";
import type { Report } from "../report/report.js";
import { MIN_DIRECTORY_FILES, directoryKnowledge } from "./directories.js";
import { EXPERT_RATIO } from "./doe.js";
import { ISLAND_SHARE, ORPHANED_SHARE, describeFileSet } from "./file-set.js";
import { knowledgeModel } from "./model.js";
import type { KnowledgeInput } from "./model.js";

/** The knowledge constants, for the report's `thresholds`. */
export const KNOWLEDGE_THRESHOLDS = {
  expertRatio: EXPERT_RATIO,
  minDirectoryFiles: MIN_DIRECTORY_FILES,
  islandShare: ISLAND_SHARE,
  orphanedShare: ORPHANED_SHARE,
};

/**
 * Finds who knows the universe files and whether they are still around.
 *
 * `commits` are the classified commits of the scope over the full history,
 * newest first, independent of the activity window; `universe` is the scope's
 * files. Only humans are experts. Returns every directory; truncating for
 * output belongs to the caller.
 */
export const knowledge = (
  input: KnowledgeInput & { readonly scope: string },
): Report["knowledge"] => {
  const model = knowledgeModel(input);
  const paths = input.universe.map(({ path }) => path);
  const repository = describeFileSet(paths, model);
  return {
    files: repository.files,
    withoutExpert: repository.withoutExpert,
    withoutActiveExpert: repository.withoutActiveExpert,
    truckFactor: {
      value: repository.truckFactor.length,
      people: repository.truckFactor,
    },
    directories: directoryKnowledge(paths, input.scope, model),
    ...lineOwnersField(repository.lineOwners),
  };
};

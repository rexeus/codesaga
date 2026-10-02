// Owns which directories the knowledge section reports and in which order.
// A directory needs enough files, and one that holds exactly the files of its parent is left to the parent.

import { Order } from "effect";

import { lineOwnersField } from "../blame/line-owners.js";
import { groupBy } from "../collections/group-by.js";
import type { Report } from "../report/report.js";
import { ancestorsOf } from "../universe/ancestors.js";
import { describeFileSet } from "./file-set.js";
import type { KnowledgeModel } from "./model.js";

/** A directory is reported when its subtree holds at least this many universe files. */
export const MIN_DIRECTORY_FILES = 3;

export type Directory = Report["knowledge"]["directories"][number];

const flagFirst = (flag: (directory: Directory) => boolean) =>
  Order.flip(
    Order.mapInput(Order.Boolean, (directory: Directory) => flag(directory)),
  );

/** Riskiest first: orphaned, islands, lower truck factor, more files, path. */
export const byRisk = Order.combineAll([
  flagFirst((directory) => directory.orphaned),
  flagFirst((directory) => directory.island),
  Order.mapInput(Order.Number, (directory: Directory) => directory.truckFactor),
  Order.flip(
    Order.mapInput(Order.Number, (directory: Directory) => directory.files),
  ),
  Order.mapInput(Order.String, (directory: Directory) => directory.path),
]);

const parentOf = (path: string): string =>
  path.slice(0, Math.max(0, path.lastIndexOf("/")));

/** The knowledge state of the subtree at `path`, which holds the universe files `paths`. */
export const describeDirectory = (
  path: string,
  paths: ReadonlyArray<string>,
  model: KnowledgeModel,
): Directory => {
  const set = describeFileSet(paths, model);
  return Object.assign(
    {
      path,
      files: set.files,
      truckFactor: set.truckFactor.length,
      island: set.island,
      orphaned: set.orphaned,
      experts: set.experts,
      reasons: set.reasons,
    },
    lineOwnersField(set.lineOwners),
  );
};

/**
 * The reported directories below `scope` (the repository when it is "."), from
 * the riskiest to the healthiest. `paths` are the universe files. The scope
 * itself is never listed: the section's truck factor describes it.
 */
export const directoryKnowledge = (
  paths: ReadonlyArray<string>,
  scope: string,
  model: KnowledgeModel,
): ReadonlyArray<Directory> => {
  const filesByDirectory = groupBy(
    paths.flatMap((path) =>
      ancestorsOf(path)
        .filter(
          (directory) => scope === "." || directory.startsWith(`${scope}/`),
        )
        .map((directory) => ({ directory, path })),
    ),
    ({ directory }) => directory,
  );
  return [...filesByDirectory]
    .filter(
      ([directory, files]) =>
        files.length >= MIN_DIRECTORY_FILES &&
        filesByDirectory.get(parentOf(directory))?.length !== files.length,
    )
    .map(([path, files]) =>
      describeDirectory(
        path,
        files.map((file) => file.path),
        model,
      ),
    )
    .toSorted(byRisk);
};

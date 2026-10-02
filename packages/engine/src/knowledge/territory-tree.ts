// Owns how deep a territory is cut: the directory tree of the files below an anchor and the giant-territory rule.
// Pure over counts, so the rule is testable beside `territory-partition.ts`, which owns the partition itself.
// Cost: one pass over the files to size the tree; each file's cut walks at most `GIANT_SPLIT_STEPS` nodes.

/** A territory with fewer universe files is grouped with its siblings as "other files". */
export const TERRITORY_MIN_FILES = 3;

/** A territory with more than this share of the universe files, and subdirectories, is split further. */
export const GIANT_TERRITORY_SHARE = 0.4;

/** A giant territory is split at most this many directory steps beyond its detail. */
export const GIANT_SPLIT_STEPS = 2;

/** A split that yields this many territories of at least `TERRITORY_MIN_FILES` files is far enough. */
const ENOUGH_VIABLE_TERRITORIES = 2;

/** A file below its anchor: the root of its package, else the scope. */
export type TreeFile = {
  readonly anchor: string;
  /** The directories between the anchor and the file. */
  readonly dirs: ReadonlyArray<string>;
};

export type TreeSizes = {
  readonly subtree: ReadonlyMap<string, number>;
  readonly direct: ReadonlyMap<string, number>;
  /** Per directory: how many territories of at least `TERRITORY_MIN_FILES` files splitting it one step yields. */
  readonly viableTerritories: ReadonlyMap<string, number>;
};

/** Identifies the directory of `file` after `depth` steps below its anchor. */
const nodeKey = (file: TreeFile, depth: number): string =>
  `${file.anchor}\0${file.dirs.slice(0, depth).join("/")}`;

const increment = (counts: Map<string, number>, key: string): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

/** The files below each directory of each anchor, those directly in it, and what splitting it would yield. */
export const treeSizes = (files: ReadonlyArray<TreeFile>): TreeSizes => {
  const subtree = new Map<string, number>();
  const direct = new Map<string, number>();
  const parentOf = new Map<string, string>();
  for (const file of files) {
    for (let depth = 0; depth <= file.dirs.length; depth += 1) {
      increment(subtree, nodeKey(file, depth));
      if (depth > 0) {
        parentOf.set(nodeKey(file, depth), nodeKey(file, depth - 1));
      }
    }
    increment(direct, nodeKey(file, file.dirs.length));
  }
  const viableTerritories = new Map<string, number>();
  for (const [child, parent] of parentOf) {
    if ((subtree.get(child) ?? 0) >= TERRITORY_MIN_FILES) {
      increment(viableTerritories, parent);
    }
  }
  for (const [node, count] of direct) {
    if (count >= TERRITORY_MIN_FILES) {
      increment(viableTerritories, node);
    }
  }
  return { subtree, direct, viableTerritories };
};

/**
 * The directory steps below the anchor at which the file's territory is cut: the
 * detail's own `base` steps, plus one for every giant territory on the way down, at
 * most `GIANT_SPLIT_STEPS`, and no further once a split yields enough territories of
 * at least `TERRITORY_MIN_FILES` files. A giant territory holds more than
 * `GIANT_TERRITORY_SHARE` of the `total` files and has subdirectories. Splitting
 * depends only on the tree, so a finer detail never cuts a file less deeply
 * than a shallower one.
 */
export const cutSteps = (
  file: TreeFile,
  base: number,
  total: number,
  sizes: TreeSizes,
): number => {
  const isGiant = (depth: number): boolean => {
    const key = nodeKey(file, depth);
    const subtree = sizes.subtree.get(key) ?? 0;
    return (
      subtree > GIANT_TERRITORY_SHARE * total &&
      subtree > (sizes.direct.get(key) ?? 0)
    );
  };
  let steps = base;
  while (
    steps < base + GIANT_SPLIT_STEPS &&
    steps < file.dirs.length &&
    isGiant(steps)
  ) {
    const parts = sizes.viableTerritories.get(nodeKey(file, steps)) ?? 0;
    steps += 1;
    if (parts >= ENOUGH_VIABLE_TERRITORIES) {
      break;
    }
  }
  return steps;
};

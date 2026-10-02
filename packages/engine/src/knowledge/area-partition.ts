// Owns cutting the universe's paths into areas: the partition per level and the "other files" groups.
// Pure over paths, so the cut is testable without history; `areas.ts` describes the knowledge of each area.
// Cost: one pass over the files per level, at most `MAX_AREA_DEPTH` levels.

import { Array as Arr, Order } from "effect";

import { groupBy } from "../collections/group-by.js";
import { ancestorsOf } from "../universe/ancestors.js";

/** An area with fewer universe files is grouped with its siblings as "other files". */
export const AREA_MIN_FILES = 3;

/** The deepest level reported. */
export const MAX_AREA_DEPTH = 6;

/** An area with more than this share of the universe files, and subdirectories, is split further. */
export const GIANT_AREA_SHARE = 0.4;

/** A giant area is split at most this many directory steps beyond its level. */
export const GIANT_SPLIT_STEPS = 2;

type AreaKind = "package" | "directory" | "rest";

/** An area and the universe files it holds. */
type PartitionArea = {
  readonly path: string;
  readonly kind: AreaKind;
  /** Repository-relative universe files, each in exactly one area of the level. */
  readonly paths: ReadonlyArray<string>;
};

export type PartitionLevel = {
  readonly depth: number;
  /** Ordered by path, then kind; `rest` areas included. */
  readonly areas: ReadonlyArray<PartitionArea>;
};

export type PartitionInput = {
  /** The universe files of the scope. */
  readonly paths: ReadonlyArray<string>;
  /** From `packageRootsOf` over the scope's tracked files; "." is the repository root. */
  readonly packageRoots: ReadonlyArray<string>;
  /** Repository-relative scope; "." for the whole repository. */
  readonly scope: string;
};

/** A file placed below its anchor: the root of its package, else the scope. */
type Placed = {
  readonly path: string;
  readonly anchor: string;
  readonly inPackage: boolean;
  /** The directories between the anchor and the file. */
  readonly dirs: ReadonlyArray<string>;
};

type NodeSizes = {
  readonly subtree: ReadonlyMap<string, number>;
  readonly direct: ReadonlyMap<string, number>;
};

const joinPath = (anchor: string, dirs: ReadonlyArray<string>): string => {
  const parts = anchor === "." ? dirs : [anchor, ...dirs];
  return parts.length === 0 ? "." : parts.join("/");
};

const parentOf = (path: string): string => {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "." : path.slice(0, slash);
};

/**
 * The package roots that count. A root with no universe file holds nothing. The
 * scope's own manifest makes the scope a package only when no package lies
 * below it, so that a monorepo's root manifest does not swallow its packages.
 */
const effectiveRoots = ({
  paths,
  packageRoots,
  scope,
}: PartitionInput): ReadonlySet<string> => {
  const populated = new Set(paths.flatMap((path) => ancestorsOf(path)));
  const holdsFiles = (root: string): boolean =>
    root === "." ? paths.length > 0 : populated.has(root);
  const nested = packageRoots.filter(
    (root) => root !== scope && holdsFiles(root),
  );
  const scopeIsPackage = packageRoots.includes(scope) && holdsFiles(scope);
  return new Set(nested.length === 0 && scopeIsPackage ? [scope] : nested);
};

const placeFiles = (input: PartitionInput): ReadonlyArray<Placed> => {
  const roots = effectiveRoots(input);
  return input.paths.map((path) => {
    const root = [".", ...ancestorsOf(path)]
      .toReversed()
      .find((directory) => roots.has(directory));
    const anchor = root ?? input.scope;
    const relative = anchor === "." ? path : path.slice(anchor.length + 1);
    return {
      path,
      anchor,
      inPackage: root !== undefined,
      dirs: relative.split("/").slice(0, -1),
    };
  });
};

const nodeKey = (file: Placed, depth: number): string =>
  `${file.anchor}\0${file.dirs.slice(0, depth).join("/")}`;

const increment = (counts: Map<string, number>, key: string): void => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

/** The files below each directory of each anchor, and those directly in it. */
const nodeSizes = (files: ReadonlyArray<Placed>): NodeSizes => {
  const subtree = new Map<string, number>();
  const direct = new Map<string, number>();
  for (const file of files) {
    for (let depth = 0; depth <= file.dirs.length; depth += 1) {
      increment(subtree, nodeKey(file, depth));
    }
    increment(direct, nodeKey(file, file.dirs.length));
  }
  return { subtree, direct };
};

/**
 * The directory steps below the anchor at which the file's area is cut: the
 * level's own steps, plus one for every giant area on the way down, at most
 * `GIANT_SPLIT_STEPS`. A giant area holds more than `GIANT_AREA_SHARE` of the
 * files and has subdirectories. Splitting depends only on the tree, so a
 * deeper level never cuts a file less deeply than a shallower one.
 */
const stepsOf = (
  file: Placed,
  base: number,
  total: number,
  sizes: NodeSizes,
): number => {
  const isGiant = (depth: number): boolean => {
    const key = nodeKey(file, depth);
    const subtree = sizes.subtree.get(key) ?? 0;
    return (
      subtree > GIANT_AREA_SHARE * total &&
      subtree > (sizes.direct.get(key) ?? 0)
    );
  };
  let steps = base;
  while (
    steps < base + GIANT_SPLIT_STEPS &&
    steps < file.dirs.length &&
    isGiant(steps)
  ) {
    steps += 1;
  }
  return steps;
};

/** The level's areas before small ones are grouped. */
const cutAt = (
  files: ReadonlyArray<Placed>,
  depth: number,
  sizes: NodeSizes,
): ReadonlyArray<PartitionArea> => {
  const areas = new Map<string, PartitionArea & { paths: Array<string> }>();
  for (const file of files) {
    const base = file.inPackage ? depth - 1 : depth;
    const steps = Math.min(
      stepsOf(file, base, files.length, sizes),
      file.dirs.length,
    );
    const kind = steps === 0 && file.inPackage ? "package" : "directory";
    const path = joinPath(file.anchor, file.dirs.slice(0, steps));
    const key = `${kind}\0${path}`;
    const area = areas.get(key) ?? { path, kind, paths: [] };
    area.paths.push(file.path);
    areas.set(key, area);
  }
  return [...areas.values()];
};

/** Groups the areas below `AREA_MIN_FILES` per parent into one `rest` area each. */
const groupSmall = (
  areas: ReadonlyArray<PartitionArea>,
  scope: string,
): ReadonlyArray<PartitionArea> => {
  const isSmall = (area: PartitionArea): boolean =>
    area.paths.length < AREA_MIN_FILES;
  const small = groupBy(
    areas.filter((area) => isSmall(area)),
    (area) => (area.path === scope ? scope : parentOf(area.path)),
  );
  return [
    ...areas.filter((area) => !isSmall(area)),
    ...[...small].map(([path, own]): PartitionArea => ({
      path,
      kind: "rest",
      paths: own.flatMap((area) => area.paths),
    })),
  ];
};

const byPathThenKind = Order.combine(
  Order.mapInput(Order.String, (area: PartitionArea) => area.path),
  Order.mapInput(Order.String, (area: PartitionArea) => area.kind),
);

const signatureOf = (areas: ReadonlyArray<PartitionArea>): string =>
  areas
    .map((area) => `${area.kind}\0${area.path}\0${area.paths.length}`)
    .toSorted()
    .join("\n");

/**
 * The partition of the universe at levels 1 to the deepest useful one, at
 * most `MAX_AREA_DEPTH`: the level after which nothing changes is the last, so
 * no two levels are alike. Each file belongs to exactly one area per level.
 * Level 1 is the package roots, or the directories below the scope without
 * any; level k is k-1 directory steps below a package root. A file outside
 * every package is cut k directory steps below the scope. A file directly in a
 * root belongs to that root's own area. Within every level an area holding
 * more than `GIANT_AREA_SHARE` of the files is split up to `GIANT_SPLIT_STEPS`
 * directories further, so one package cannot become one giant area. Areas with
 * fewer than `AREA_MIN_FILES` files are grouped per parent as one `rest` area.
 * Level 1 is always returned, with no areas for no files.
 */
export const partitionLevels = (
  input: PartitionInput,
): Arr.NonEmptyReadonlyArray<PartitionLevel> => {
  const files = placeFiles(input);
  const sizes = nodeSizes(files);
  const cuts = Arr.makeBy(MAX_AREA_DEPTH, (index) =>
    cutAt(files, index + 1, sizes),
  );
  const signatures = cuts.map((cut) => signatureOf(cut));
  const repeated = signatures.findIndex(
    (signature, index) => index > 0 && signature === signatures[index - 1],
  );
  const [coarsest, ...finer] = cuts;
  const kept: Arr.NonEmptyReadonlyArray<ReadonlyArray<PartitionArea>> = [
    coarsest,
    ...(repeated === -1 ? finer : finer.slice(0, repeated - 1)),
  ];
  return Arr.map(kept, (cut, index) => ({
    depth: index + 1,
    areas: groupSmall(cut, input.scope).toSorted(byPathThenKind),
  }));
};

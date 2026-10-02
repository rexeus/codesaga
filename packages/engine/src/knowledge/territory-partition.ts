// Owns cutting the universe's paths into territories: the partition per detail and the "other files" groups.
// Pure over paths, so the cut is testable without history; `territories.ts` describes the knowledge of each territory.
// Cost: one pass over the files per detail, at most `MAX_DETAIL` details.

import { Array as Arr, Order } from "effect";

import { groupBy } from "../collections/group-by.js";
import { ancestorsOf } from "../universe/ancestors.js";
import { TERRITORY_MIN_FILES, cutSteps, treeSizes } from "./territory-tree.js";
import type { TreeFile, TreeSizes } from "./territory-tree.js";

/** The deepest detail reported. */
export const MAX_DETAIL = 6;

type TerritoryKind = "package" | "folder" | "other";

/** A territory and the universe files it holds. */
export type PartitionTerritory = {
  readonly path: string;
  readonly kind: TerritoryKind;
  /** Repository-relative universe files, each in exactly one territory of the detail. */
  readonly paths: ReadonlyArray<string>;
};

export type PartitionDetail = {
  readonly detail: number;
  /** Ordered by path, then kind; `other` territories included. */
  readonly territories: ReadonlyArray<PartitionTerritory>;
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
type Placed = TreeFile & {
  readonly path: string;
  readonly inPackage: boolean;
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

/** The detail's territories before small ones are grouped. */
const cutAt = (
  files: ReadonlyArray<Placed>,
  detail: number,
  sizes: TreeSizes,
): ReadonlyArray<PartitionTerritory> => {
  const territories = new Map<
    string,
    PartitionTerritory & { paths: Array<string> }
  >();
  for (const file of files) {
    const base = file.inPackage ? detail - 1 : detail;
    const steps = Math.min(
      cutSteps(file, base, files.length, sizes),
      file.dirs.length,
    );
    const kind = steps === 0 && file.inPackage ? "package" : "folder";
    const path = joinPath(file.anchor, file.dirs.slice(0, steps));
    const key = `${kind}\0${path}`;
    const territory = territories.get(key) ?? { path, kind, paths: [] };
    territory.paths.push(file.path);
    territories.set(key, territory);
  }
  return [...territories.values()];
};

/** Groups the territories below `TERRITORY_MIN_FILES` per parent into one `other` territory each. */
const groupSmall = (
  territories: ReadonlyArray<PartitionTerritory>,
  scope: string,
): ReadonlyArray<PartitionTerritory> => {
  const isSmall = (territory: PartitionTerritory): boolean =>
    territory.paths.length < TERRITORY_MIN_FILES;
  const small = groupBy(
    territories.filter((territory) => isSmall(territory)),
    (territory) =>
      territory.path === scope ? scope : parentOf(territory.path),
  );
  return [
    ...territories.filter((territory) => !isSmall(territory)),
    ...[...small].map(([path, own]): PartitionTerritory => ({
      path,
      kind: "other",
      paths: own.flatMap((territory) => territory.paths),
    })),
  ];
};

const byPathThenKind = Order.combine(
  Order.mapInput(
    Order.String,
    (territory: PartitionTerritory) => territory.path,
  ),
  Order.mapInput(
    Order.String,
    (territory: PartitionTerritory) => territory.kind,
  ),
);

const signatureOf = (territories: ReadonlyArray<PartitionTerritory>): string =>
  territories
    .map(
      (territory) =>
        `${territory.kind}\0${territory.path}\0${territory.paths.length}`,
    )
    .toSorted()
    .join("\n");

/**
 * The partition of the universe at details 1 to the deepest useful one, at
 * most `MAX_DETAIL`: the detail after which nothing changes is the last, so
 * no two details are alike. Each file belongs to exactly one territory per detail.
 * Detail 1 is the package roots, or the directories below the scope without
 * any; detail k is k-1 directory steps below a package root. A file outside
 * every package is cut k directory steps below the scope. A file directly in a
 * root belongs to that root's own territory. Within every detail a territory holding
 * more than `GIANT_TERRITORY_SHARE` of the files is split up to `GIANT_SPLIT_STEPS`
 * directories further, stopping once a split yields two territories of at least
 * `TERRITORY_MIN_FILES` files (see `cutSteps`), so one package cannot become one
 * giant territory. Territories with
 * fewer than `TERRITORY_MIN_FILES` files are grouped per parent as one `other` territory.
 * Detail 1 is always returned, with no territories for no files. A scope that is
 * itself a file has one detail with one `folder` territory for that file.
 */
export const partitionDetails = (
  input: PartitionInput,
): Arr.NonEmptyReadonlyArray<PartitionDetail> => {
  const [onlyPath] = input.paths;
  if (input.paths.length === 1 && onlyPath === input.scope) {
    return [
      {
        detail: 1,
        territories: [{ path: onlyPath, kind: "folder", paths: [onlyPath] }],
      },
    ];
  }
  const files = placeFiles(input);
  const sizes = treeSizes(files);
  const cuts = Arr.makeBy(MAX_DETAIL, (index) =>
    cutAt(files, index + 1, sizes),
  );
  const signatures = cuts.map((cut) => signatureOf(cut));
  const repeated = signatures.findIndex(
    (signature, index) => index > 0 && signature === signatures[index - 1],
  );
  const [coarsest, ...finer] = cuts;
  const kept: Arr.NonEmptyReadonlyArray<ReadonlyArray<PartitionTerritory>> = [
    coarsest,
    ...(repeated === -1 ? finer : finer.slice(0, repeated - 1)),
  ];
  return Arr.map(kept, (cut, index) => ({
    detail: index + 1,
    territories: groupSmall(cut, input.scope).toSorted(byPathThenKind),
  }));
};

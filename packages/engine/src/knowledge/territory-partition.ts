// Owns cutting the universe's paths into the territory tree: the first cut, the splits and the detail at which each opens.
// Pure over paths and experts, so the cut is testable without history; `territories.ts` describes the knowledge of each territory.
// Cost: the first cut is one pass over the files; each split plans once per territory it considers, so about one pass per tree level.

import { Order } from "effect";

import { groupBy } from "../collections/group-by.js";
import { ancestorsOf } from "../universe/ancestors.js";
import { TERRITORY_MIN_FILES, planSplit } from "./territory-tree.js";
import type { SplitContext, SplitPlan } from "./territory-tree.js";

/** The finest detail reported. */
export const MAX_DETAIL = 6;

type TerritoryKind = "package" | "folder" | "other";

/** A territory, the universe files it holds and the territories it splits into. */
export type PartitionTerritory = {
  readonly path: string;
  readonly kind: TerritoryKind;
  /** Repository-relative universe files, including those of the children. */
  readonly paths: ReadonlyArray<string>;
  /** The territories it splits into, each file in exactly one; empty for a territory that does not split. */
  readonly territories: ReadonlyArray<PartitionTerritory>;
  /** Why it splits; present exactly when `territories` is not empty. */
  readonly splitReason?: string;
  /** The detail from which the children are shown instead of the territory, at least 2; present exactly when `territories` is not empty. */
  readonly splitDetail?: number;
};

export type PartitionInput = {
  /** The universe files of the scope. */
  readonly paths: ReadonlyArray<string>;
  /** From `packageRootsOf` over the scope's tracked files; "." is the repository root. */
  readonly packageRoots: ReadonlyArray<string>;
  /** Repository-relative scope; "." for the whole repository. */
  readonly scope: string;
  /** The emails of the experts of a universe file; empty for none. */
  readonly expertsOf: SplitContext["expertsOf"];
};

export type Partition = {
  /** The first cut, ordered by path, then kind; the small territories are one `other` territory last. */
  readonly territories: ReadonlyArray<PartitionTerritory>;
  /** The finest detail, from 1: the splits are spread over the details 2 to this one. */
  readonly maxDetail: number;
  /** The last detail that opens a split between folders with different experts; 1 when none does. */
  readonly expertiseDetail: number;
};

type Draft = {
  path: string;
  kind: TerritoryKind;
  paths: ReadonlyArray<string>;
  territories: Array<Draft>;
  splitReason?: string;
  splitDetail?: number;
};

const draftOf = (
  path: string,
  kind: TerritoryKind,
  paths: ReadonlyArray<string>,
): Draft => ({ path, kind, paths, territories: [] });

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

/** The territory a file belongs to in the first cut: its package, else its top-level folder below the scope, else none. */
const firstCutKey = (
  path: string,
  roots: ReadonlySet<string>,
  scope: string,
): { readonly path: string; readonly kind: TerritoryKind } | undefined => {
  const root = [".", ...ancestorsOf(path)]
    .toReversed()
    .find((directory) => roots.has(directory));
  if (root !== undefined) {
    return { path: root, kind: "package" };
  }
  const relative = scope === "." ? path : path.slice(scope.length + 1);
  const [top] = relative.split("/");
  return relative.includes("/") && top !== undefined
    ? { path: scope === "." ? top : `${scope}/${top}`, kind: "folder" }
    : undefined;
};

/** Packages, or the top-level folders where a file lies in none; groups under `TERRITORY_MIN_FILES` files become the scope's other files. */
const firstCut = (input: PartitionInput): ReadonlyArray<Draft> => {
  const roots = effectiveRoots(input);
  const groups = groupBy(input.paths, (path) => {
    const key = firstCutKey(path, roots, input.scope);
    return key === undefined ? "" : `${key.kind}\0${key.path}`;
  });
  const named: Array<Draft> = [];
  const leftovers: Array<string> = [];
  for (const [key, paths] of groups) {
    const [kind, path] = key.split("\0");
    if (
      kind === undefined ||
      path === undefined ||
      paths.length < TERRITORY_MIN_FILES
    ) {
      leftovers.push(...paths);
    } else {
      named.push(
        draftOf(path, kind === "package" ? "package" : "folder", paths),
      );
    }
  }
  return [
    ...named.toSorted((a, b) => (a.path < b.path ? -1 : 1)),
    ...(leftovers.length === 0
      ? []
      : [draftOf(input.scope, "other", leftovers)]),
  ];
};

type Candidate = { readonly node: Draft; readonly plan: SplitPlan };

/** The split to apply first: more expertise gain, then more files, then the path. */
const byValue = Order.combineAll([
  Order.flip(
    Order.mapInput(Order.Number, ({ plan }: Candidate) => plan.expertiseGain),
  ),
  Order.flip(
    Order.mapInput(Order.Number, ({ node }: Candidate) => node.paths.length),
  ),
  Order.mapInput(Order.String, ({ node }: Candidate) => node.path),
]);

/**
 * Splits every territory that should split, the most valuable split first; a
 * split's children are considered once it is applied. Returns the splits in
 * the order they were applied.
 */
const applySplits = (
  roots: ReadonlyArray<Draft>,
  context: SplitContext,
): ReadonlyArray<Candidate> => {
  let pending: ReadonlyArray<Candidate> = [];
  const applied: Array<Candidate> = [];
  const consider = (node: Draft): void => {
    const plan = planSplit(node, context);
    if (plan !== undefined) {
      pending = [...pending, { node, plan }];
    }
  };
  for (const root of roots) {
    consider(root);
  }
  for (;;) {
    const [chosen, ...rest] = pending.toSorted(byValue);
    if (chosen === undefined) {
      return applied;
    }
    pending = rest;
    const { node, plan } = chosen;
    node.territories = [
      ...plan.folders.map(({ path, paths }) => draftOf(path, "folder", paths)),
      ...(plan.other.length === 0
        ? []
        : [draftOf(node.path, "other", plan.other)]),
    ];
    node.splitReason = plan.reason;
    for (const child of node.territories) {
      consider(child);
    }
    applied.push(chosen);
  }
};

/**
 * The territory tree of the universe. The first cut is the package roots, or the
 * top-level directories below the scope for files outside every package; a file
 * directly in a package root belongs to that root's own territory. A territory
 * splits into its child folders by `planSplit`, and territories with fewer than
 * `TERRITORY_MIN_FILES` files are grouped as other files. The splits are applied in
 * order of value (more expertise gain, then more files) and spread evenly over
 * the details 2 to `maxDetail`, at most `MAX_DETAIL`: a split opens at its
 * detail and everything it yields is shown from there. Each file belongs to
 * exactly one territory at every detail. A scope that is itself a file has one
 * `folder` territory, that file.
 */
export const partitionTerritories = (input: PartitionInput): Partition => {
  const [onlyPath] = input.paths;
  if (input.paths.length === 1 && onlyPath === input.scope) {
    return {
      territories: [
        { path: onlyPath, kind: "folder", paths: [onlyPath], territories: [] },
      ],
      maxDetail: 1,
      expertiseDetail: 1,
    };
  }
  const roots = firstCut(input);
  const splits = applySplits(roots, {
    totalFiles: input.paths.length,
    expertsOf: input.expertsOf,
  });
  const maxDetail = Math.min(MAX_DETAIL, splits.length + 1);
  const detailOf = (index: number): number =>
    2 + Math.floor((index * (maxDetail - 1)) / splits.length);
  let expertiseDetail = 1;
  for (const [index, { node, plan }] of splits.entries()) {
    node.splitDetail = detailOf(index);
    expertiseDetail =
      plan.expertiseGain > 0
        ? Math.max(expertiseDetail, node.splitDetail)
        : expertiseDetail;
  }
  return { territories: roots, maxDetail, expertiseDetail };
};

// Owns the import graph of the files: one node per TypeScript or JavaScript file, one edge per file pair where one imports the other.
// Built from the module requests each parsed file stored and resolved by `createResolver`; the pure data the figures are computed from.

import { isTestPath } from "../../universe/path-kinds.js";
import type { ParsedFile } from "../parsed-file.js";
import { createResolver } from "./resolve.js";
import type { Resolution, ResolverInputs } from "./resolve.js";

/** A file importing another; `isType` when every request of the pair only brings types. */
type ImportEdge = {
  readonly from: number;
  readonly to: number;
  readonly isType: boolean;
};

/** How many files name each specifier that points into the repository where no file can be found. */
type UnresolvedCounts = ReadonlyMap<string, number>;

/** The graph and what the resolver made of the requests that are no edge. */
export type ImportGraph = {
  /** The nodes' paths, in path order; a node's number is its position. */
  readonly paths: ReadonlyArray<string>;
  /** The number of each path. */
  readonly indexOf: ReadonlyMap<string, number>;
  /** Whether the node at that position is a test file. */
  readonly isTest: ReadonlyArray<boolean>;
  /** Each file pair once, in the order of the importing file; a self-import is an edge from a node to itself. */
  readonly edges: ReadonlyArray<ImportEdge>;
  /** Specifiers resolved to a file, and those counted without being resolved, each counted once per file that names it. */
  readonly requests: {
    readonly resolved: number;
    readonly external: number;
    readonly assets: number;
    readonly unresolved: UnresolvedCounts;
  };
};

/** What one file's requests came to: the files it imports, each with whether only types, and what each distinct specifier resolved to. */
type FileRequests = {
  readonly targets: ReadonlyMap<number, boolean>;
  readonly outcomes: ReadonlyMap<string, Resolution>;
};

const requestsOf = (
  { path, facts }: ParsedFile,
  indexOf: ReadonlyMap<string, number>,
  resolve: (from: string, specifier: string) => Resolution,
): FileRequests => {
  const targets = new Map<number, boolean>();
  const outcomes = new Map<string, Resolution>();
  for (const { specifier, isType } of facts.modules.requests) {
    const found = resolve(path, specifier);
    outcomes.set(specifier, found);
    const to = found.kind === "file" ? indexOf.get(found.path) : undefined;
    if (to !== undefined) {
      targets.set(to, (targets.get(to) ?? true) && isType);
    }
  }
  return { targets, outcomes };
};

type Tally = {
  resolved: number;
  external: number;
  assets: number;
  readonly unresolved: Map<string, number>;
};

const tally = (counts: Tally, outcomes: ReadonlyMap<string, Resolution>) => {
  for (const [specifier, { kind }] of outcomes) {
    if (kind === "unresolved") {
      counts.unresolved.set(
        specifier,
        (counts.unresolved.get(specifier) ?? 0) + 1,
      );
    } else if (kind === "file") {
      counts.resolved += 1;
    } else if (kind === "external") {
      counts.external += 1;
    } else {
      counts.assets += 1;
    }
  }
};

/**
 * The graph over `paths`, every TypeScript and JavaScript file of the
 * universe, with the edges of `parsed`, the files whose requests are known.
 * Files that were skipped or are declaration files are nodes without outgoing
 * edges. `aliasesFor` and `manifests` say how bare specifiers resolve.
 */
export const importGraphOf = (
  paths: ReadonlyArray<string>,
  parsed: ReadonlyArray<ParsedFile>,
  resolution: Pick<ResolverInputs, "manifests" | "aliasesFor">,
): ImportGraph => {
  const sorted = paths.toSorted();
  const indexOf = new Map(sorted.map((path, index) => [path, index]));
  const resolve = createResolver({ files: new Set(sorted), ...resolution });
  const edges: Array<ImportEdge> = [];
  const counts: Tally = {
    resolved: 0,
    external: 0,
    assets: 0,
    unresolved: new Map(),
  };
  for (const file of parsed) {
    const { targets, outcomes } = requestsOf(file, indexOf, resolve);
    const from = indexOf.get(file.path);
    tally(counts, outcomes);
    for (const [to, isType] of targets) {
      if (from !== undefined) {
        edges.push({ from, to, isType });
      }
    }
  }
  return {
    paths: sorted,
    indexOf,
    isTest: sorted.map((path) => isTestPath(path)),
    edges,
    requests: counts,
  };
};

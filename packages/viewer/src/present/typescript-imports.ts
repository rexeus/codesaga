import { formatCount, formatNoun } from "./format.js";
import type { TypeScriptDeepDive } from "./typescript-summary.js";

type Imports = NonNullable<TypeScriptDeepDive["imports"]>;
type Ref = Imports["territories"]["edges"][number]["from"];

/** A territory as the import map names it. */
export type TerritoryName = {
  readonly name: string;
  readonly kind: Ref["kind"];
};

/** `/ (root)` for the folder that holds the root files, `Other files in x` for the small ones grouped under `x`. */
const territoryName = ({ path, kind }: Ref): TerritoryName => {
  if (kind === "other") {
    return {
      name: path === "." ? "Other files" : `Other files in ${path}`,
      kind,
    };
  }
  return { name: path === "." ? "/ (root)" : path, kind };
};

/** One import edge between territories. */
export type EdgeRow = {
  readonly from: TerritoryName;
  readonly to: TerritoryName;
  /** `211`; the file pairs where `from` imports `to`. */
  readonly files: string;
  /** The files over the largest edge's, 0 to 1. */
  readonly fraction: number;
  /** The part of them that imports only types, 0 to 1. */
  readonly typeOnlyFraction: number;
  /** `35 of them types only`, or null when none is. */
  readonly typeOnly: string | null;
};

/** The edges, the one with the most file pairs first, as the engine lists them. */
export const edgeRows = ({ territories }: Imports): EdgeRow[] => {
  const largest = Math.max(1, ...territories.edges.map(({ files }) => files));
  return territories.edges.map(({ from, to, files, typeOnlyFiles }) => ({
    from: territoryName(from),
    to: territoryName(to),
    files: formatCount(files),
    fraction: files / largest,
    typeOnlyFraction: files === 0 ? 0 : typeOnlyFiles / files,
    typeOnly:
      typeOnlyFiles === 0 ? null : `${formatCount(typeOnlyFiles)} types only`,
  }));
};

/** A territory with its coupling. */
export type CouplingRow = TerritoryName & {
  readonly files: string;
  /** Edges into it from other territories. */
  readonly ca: string;
  /** Edges out of it into other territories. */
  readonly ce: string;
  /** `0.86`, or null for a territory with no edge. */
  readonly instability: string | null;
  /** 0 to 1 for the bar; null with `instability`. */
  readonly instabilityFraction: number | null;
};

/** The territories with the most edges first, as the engine lists them. */
export const couplingRows = ({ territories }: Imports): CouplingRow[] =>
  territories.territories.map((territory) => ({
    ...territoryName(territory),
    files: formatCount(territory.files),
    ca: formatCount(territory.ca),
    ce: formatCount(territory.ce),
    instability:
      territory.instability === undefined
        ? null
        : territory.instability.toFixed(2),
    instabilityFraction: territory.instability ?? null,
  }));

/** The lists under the edges and what the output limit cut from them. */
export type MapNotes = {
  readonly detail: number;
  /** `43 territories, 61 edges`. */
  readonly counts: string;
  /** What the report left out of the lists, or null when they are whole. */
  readonly truncated: string | null;
  /** Groups of territories that import each other, each a list of names. */
  readonly mutual: readonly (readonly TerritoryName[])[];
  /** Words for the groups the limit cut, or null. */
  readonly mutualMore: string | null;
  /** Edges toward a territory that is less stable than the one importing it. */
  readonly towardLessStable: readonly {
    readonly from: TerritoryName;
    readonly to: TerritoryName;
    readonly files: string;
    readonly fromInstability: string;
    readonly toInstability: string;
  }[];
  readonly towardMore: string | null;
};

const moreOf = (shown: number, total: number, noun: string): string | null =>
  shown < total
    ? `${formatCount(total - shown)} more ${noun} not listed`
    : null;

/** The facts around the edge list: counts, mutual imports and edges toward less stable territories. */
export const mapNotes = ({ territories }: Imports): MapNotes => {
  const cut =
    territories.territories.length < territories.totalTerritories ||
    territories.edges.length < territories.totalEdges;
  return {
    detail: territories.detail,
    counts: `${formatNoun(territories.totalTerritories, "territory", "territories")}, ${formatNoun(territories.totalEdges, "edge")}`,
    truncated: cut
      ? `The report limits the lists to ${formatCount(territories.territories.length)} territories and ${formatCount(territories.edges.length)} edges.`
      : null,
    mutual: territories.mutualImports.map((group) =>
      group.territories.map(territoryName),
    ),
    mutualMore: moreOf(
      territories.mutualImports.length,
      territories.totalMutualImports,
      "groups",
    ),
    towardLessStable: territories.towardLessStable.map((edge) => ({
      from: territoryName(edge.from),
      to: territoryName(edge.to),
      files: formatNoun(edge.files, "file pair"),
      fromInstability: edge.fromInstability.toFixed(2),
      toInstability: edge.toInstability.toFixed(2),
    })),
    towardMore: moreOf(
      territories.towardLessStable.length,
      territories.totalTowardLessStable,
      "edges",
    ),
  };
};

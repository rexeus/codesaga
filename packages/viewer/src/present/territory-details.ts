import type { Report } from "@codesaga/engine";

type Tree = Report["knowledge"]["territories"];

/** A territory with the territories inside it, as the report has them. */
export type Territory = Tree["territories"][number];

/** The territories shown at one detail. */
export type Detail = {
  readonly detail: number;
  /** The territories at this detail before the report's output limit; more than `territories` when it cut some. */
  readonly totalTerritories: number;
  /** Where the tree is open at this detail, other files last. */
  readonly territories: ReadonlyArray<Territory>;
};

/** The report's territory tree with every detail laid out flat, which is what the slider moves over. */
export type Territories = {
  readonly detail: number;
  readonly recommendedDetail: number;
  readonly reason: string;
  readonly details: ReadonlyArray<Detail>;
};

type Level = {
  readonly shown: ReadonlyArray<Territory>;
  readonly total: number;
};

/** The territories of one list that are shown at `detail`: a territory is replaced by its children from its `splitDetail` on. */
const levelAt = (
  siblings: ReadonlyArray<Territory>,
  total: number,
  detail: number,
): Level => {
  let cutOff = total - siblings.length;
  const shown = siblings.flatMap((territory) => {
    if (territory.splitDetail === undefined || territory.splitDetail > detail) {
      return [territory];
    }
    const inside = levelAt(
      territory.territories,
      territory.totalTerritories,
      detail,
    );
    cutOff += inside.total - inside.shown.length;
    return inside.shown;
  });
  return { shown, total: shown.length + cutOff };
};

/** Every detail of the report's territory tree, each with its territories listed flat, other files last. */
export const territoryDetails = (tree: Tree): Territories => ({
  detail: tree.detail,
  recommendedDetail: tree.recommendedDetail,
  reason: tree.reason,
  details: Array.from({ length: tree.maxDetail }, (_, index) => {
    const { shown, total } = levelAt(
      tree.territories,
      tree.totalTerritories,
      index + 1,
    );
    return {
      detail: index + 1,
      totalTerritories: total,
      territories: [
        ...shown.filter(({ kind }) => kind !== "other"),
        ...shown.filter(({ kind }) => kind === "other"),
      ],
    };
  }),
});

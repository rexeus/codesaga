import type { Territory } from "./territory-details.js";

const CHIPS_SHOWN = 3;

/** What identifies a territory in the whole tree: `path` alone is shared by a package and its other files. */
export const territoryKey = ({ kind, path }: Territory): string =>
  `${kind}:${path}`;

/** Whether the territory is shown through the territories inside it at `detail`. */
export const splitsAt = ({ splitDetail }: Territory, detail: number): boolean =>
  splitDetail !== undefined && splitDetail <= detail;

/** The territories inside a territory, as a count and the names of the first few. */
export type Inside = {
  /** Every territory it splits into, including those an output limit cut off. */
  readonly count: number;
  /** The last folder of the first named territories, other files left out. */
  readonly names: readonly string[];
  /** The named territories that the chips do not show. */
  readonly more: number;
};

const leafOf = (path: string): string => path.split("/").at(-1) ?? path;

/** The territories inside `territory`, or null when it does not split. */
export const insideOf = (territory: Territory): Inside | null => {
  if (territory.splitDetail === undefined) {
    return null;
  }
  const named = territory.territories.filter(({ kind }) => kind !== "other");
  const otherFiles = territory.territories.length - named.length;
  const names = named.slice(0, CHIPS_SHOWN).map(({ path }) => leafOf(path));
  return {
    count: territory.totalTerritories,
    names,
    more: Math.max(0, territory.totalTerritories - otherFiles - names.length),
  };
};

/** `keys` with `key` added, or removed when it was there; `keys` itself stays as it was. */
export const toggled = (
  keys: ReadonlySet<string>,
  key: string,
): ReadonlySet<string> => {
  const next = new Set(keys);
  if (!next.delete(key)) {
    next.add(key);
  }
  return next;
};

/** The engine's reason for a split as the line that heads the territories inside: `Split · big: 52 files`. */
export const splitReasonLine = (reason: string): string => `Split · ${reason}`;

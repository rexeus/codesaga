// Paths and a partition for the territory tests: files `<directory>/f0.ts`, ... and experts by folder.
import { partitionTerritories } from "../knowledge/territory-partition.js";
import type {
  PartitionInput,
  PartitionTerritory,
} from "../knowledge/territory-partition.js";

/** `count` files `<directory>/f0.ts`, `<directory>/f1.ts`, ... */
export const filesIn = (
  directory: string,
  count: number,
): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `${directory}/f${index}.ts`);

/** Nobody is expert on anything unless a folder prefix says whose it is. */
const expertsBy =
  (
    experts: Readonly<Record<string, string>> = {},
  ): PartitionInput["expertsOf"] =>
  (path) => {
    const prefix = Object.keys(experts).find((folder) =>
      path.startsWith(`${folder}/`),
    );
    const expert = prefix === undefined ? undefined : experts[prefix];
    return expert === undefined ? [] : [expert];
  };

export const partition = (
  paths: ReadonlyArray<string>,
  packageRoots: ReadonlyArray<string>,
  options: {
    scope?: string;
    experts?: Readonly<Record<string, string>>;
  } = {},
) =>
  partitionTerritories({
    paths,
    packageRoots,
    scope: options.scope ?? ".",
    expertsOf: expertsBy(options.experts),
  });

/** `kind path files` of each territory, in the order given. */
export const summarize = (
  territories: ReadonlyArray<PartitionTerritory>,
): ReadonlyArray<string> =>
  territories.map(({ kind, path, paths }) => `${kind} ${path} ${paths.length}`);

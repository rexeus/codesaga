import { describe, expect, it } from "vitest";

import { territoriesAtDetail } from "./territories.js";
import { partitionTerritories } from "./territory-partition.js";
import type {
  PartitionInput,
  PartitionTerritory,
} from "./territory-partition.js";

/** A deterministic linear congruential generator, so a failing case can be rebuilt from its seed. */
const generatorOf = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
};

const NAMES = ["a", "b", "c", "src", "test", "lib"];
const PEOPLE = ["ada", "grace", "linus"];

/** A random tree of files up to 4 directories deep, with manifests in some directories, random experts and a scope that is the root or a directory. */
const inputOf = (seed: number): PartitionInput => {
  const next = generatorOf(seed);
  const below = (limit: number): number => Math.floor(next() * limit);
  const directories = Array.from({ length: 6 + below(20) }, () =>
    Array.from({ length: below(5) }, () => NAMES[below(NAMES.length)]).join(
      "/",
    ),
  );
  const paths = [
    ...new Set(
      directories.flatMap((directory) =>
        Array.from({ length: 1 + below(40) }, (_, index) =>
          directory === "" ? `f${index}.ts` : `${directory}/f${index}.ts`,
        ),
      ),
    ),
  ];
  const packageRoots = [
    ...new Set(
      directories
        .filter(() => next() < 0.3)
        .map((directory) => (directory === "" ? "." : directory)),
    ),
  ].toSorted();
  const scopeDirectory = directories[below(directories.length)] ?? "";
  const scope = scopeDirectory === "" || next() < 0.5 ? "." : scopeDirectory;
  const experts = new Map(
    paths.map((path) => [
      path,
      PEOPLE.filter(() => next() < 0.4 * (path.split("/").length % 3)),
    ]),
  );
  return {
    paths: paths.filter(
      (path) => scope === "." || path.startsWith(`${scope}/`),
    ),
    packageRoots: packageRoots.filter(
      (root) => scope === "." || root === scope || root.startsWith(`${scope}/`),
    ),
    scope,
    expertsOf: (path) => experts.get(path) ?? [],
  };
};

const SEEDS = Array.from({ length: 300 }, (_, index) => index + 1);

/** Why the case failed, naming its seed. */
const caseOf = (seed: number, what: string): string => `seed ${seed}: ${what}`;

const MIN_FILES = 3;

/** Every territory of the tree, parents before children. */
const allOf = (
  territories: ReadonlyArray<PartitionTerritory>,
): ReadonlyArray<PartitionTerritory> =>
  territories.flatMap((territory) => [
    territory,
    ...allOf(territory.territories),
  ]);

describe("partitionTerritories over generated trees: coverage", () => {
  it("places every file in exactly one territory at every detail", () => {
    for (const seed of SEEDS) {
      const input = inputOf(seed);
      const { territories, maxDetail } = partitionTerritories(input);
      for (let detail = 1; detail <= maxDetail; detail += 1) {
        expect(
          territoriesAtDetail(territories, detail)
            .flatMap(({ paths }) => paths)
            .toSorted(),
          caseOf(seed, `detail ${detail}`),
        ).toStrictEqual(input.paths.toSorted());
      }
    }
  });
});

describe("partitionTerritories over generated trees: division", () => {
  it("divides every split territory's files among its children, which are at least two folders of 3 files and other files", () => {
    for (const seed of SEEDS) {
      const { territories } = partitionTerritories(inputOf(seed));
      for (const territory of allOf(territories)) {
        const children = territory.territories;
        if (children.length === 0) {
          continue;
        }
        const folders = children.filter(({ kind }) => kind === "folder");
        expect(
          children.flatMap(({ paths }) => paths).toSorted(),
          caseOf(seed, territory.path),
        ).toStrictEqual(territory.paths.toSorted());
        expect(folders.length, caseOf(seed, territory.path)).toBeGreaterThan(1);
        expect(
          folders.every(({ paths }) => paths.length >= MIN_FILES),
          caseOf(seed, territory.path),
        ).toBe(true);
        expect(
          children.filter(({ kind }) => kind === "other").length,
          caseOf(seed, territory.path),
        ).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("partitionTerritories over generated trees: reasons", () => {
  it("gives every split a reason that is true and a detail no earlier than its parent's", () => {
    for (const seed of SEEDS) {
      const input = inputOf(seed);
      const { territories, maxDetail } = partitionTerritories(input);
      const bound = Math.min(150, Math.max(30, input.paths.length / 4));
      const check = (
        territory: PartitionTerritory,
        parentDetail: number,
      ): void => {
        if (territory.territories.length === 0) {
          expect(territory.splitReason, caseOf(seed, territory.path)).toBe(
            undefined,
          );
          return;
        }
        const detail = territory.splitDetail ?? 0;
        const folders = territory.territories.map(({ path }) => path);
        const reason = territory.splitReason ?? "";
        const isBig =
          territory.paths.length > bound ||
          territory.paths.length > 0.4 * input.paths.length;
        expect(detail, caseOf(seed, territory.path)).toBeGreaterThanOrEqual(
          Math.max(2, parentDetail),
        );
        expect(detail, caseOf(seed, territory.path)).toBeLessThanOrEqual(
          maxDetail,
        );
        expect(
          reason === `big: ${territory.paths.length} files`
            ? isBig
            : folders.some((first) =>
                folders.some(
                  (second) =>
                    reason === `${first} and ${second} have different experts`,
                ),
              ),
          caseOf(seed, `${territory.path}: ${reason}`),
        ).toBe(true);
        for (const child of territory.territories) {
          check(child, detail);
        }
      };
      for (const territory of territories) {
        check(territory, 2);
      }
    }
  });
});

describe("partitionTerritories over generated trees: details", () => {
  it("opens at least one split at every detail after the first and never splits other files", () => {
    for (const seed of SEEDS) {
      const { territories, maxDetail } = partitionTerritories(inputOf(seed));
      const splits = allOf(territories).filter(
        ({ splitDetail }) => splitDetail !== undefined,
      );
      expect(
        [...new Set(splits.map(({ splitDetail }) => splitDetail))].toSorted(
          (a, b) => (a ?? 0) - (b ?? 0),
        ),
        caseOf(seed, "details"),
      ).toStrictEqual(
        Array.from({ length: maxDetail - 1 }, (_, index) => index + 2),
      );
      expect(
        splits.filter(({ kind }) => kind === "other"),
        caseOf(seed, "other files"),
      ).toStrictEqual([]);
    }
  });
});

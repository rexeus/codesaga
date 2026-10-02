import { describe, expect, it } from "vitest";

import { partitionLevels } from "./area-partition.js";
import type { PartitionInput } from "./area-partition.js";

/** A deterministic linear congruential generator, so a failing case can be rebuilt from its seed. */
const generatorOf = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
};

const NAMES = ["a", "b", "c", "src", "test", "lib"];

/** A random tree of files up to 7 directories deep, with manifests in some directories and a scope that is the root or a directory. */
const inputOf = (seed: number): PartitionInput => {
  const next = generatorOf(seed);
  const below = (limit: number): number => Math.floor(next() * limit);
  const directories = Array.from({ length: 2 + below(12) }, () =>
    Array.from({ length: below(7) }, () => NAMES[below(NAMES.length)]).join(
      "/",
    ),
  );
  const paths = [
    ...new Set(
      directories.flatMap((directory) =>
        Array.from({ length: 1 + below(6) }, (_, index) =>
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
  return {
    paths: paths.filter(
      (path) => scope === "." || path.startsWith(`${scope}/`),
    ),
    packageRoots: packageRoots.filter(
      (root) => scope === "." || root === scope || root.startsWith(`${scope}/`),
    ),
    scope,
  };
};

const SEEDS = Array.from({ length: 300 }, (_, index) => index + 1);

/** Why the case failed, naming its seed. */
const caseOf = (seed: number, what: string): string => `seed ${seed}: ${what}`;

describe("partitionLevels over generated trees", () => {
  it("places every file in exactly one area per level", () => {
    for (const seed of SEEDS) {
      const input = inputOf(seed);
      for (const { depth, areas } of partitionLevels(input)) {
        expect(
          areas.flatMap(({ paths }) => paths).toSorted(),
          caseOf(seed, `level ${depth}`),
        ).toStrictEqual(input.paths.toSorted());
      }
    }
  });

  // `rest` areas are left out: they group the small areas of one parent, which may come from different areas of the level above.
  it("nests every area of a level inside one area of the level above", () => {
    for (const seed of SEEDS) {
      const levels = partitionLevels(inputOf(seed));
      for (const [index, finer] of levels.slice(1).entries()) {
        const coarser = levels[index]?.areas ?? [];
        for (const area of finer.areas.filter(({ kind }) => kind !== "rest")) {
          const homes = coarser.filter((candidate) =>
            area.paths.every((path) => candidate.paths.includes(path)),
          );
          expect(
            homes,
            caseOf(seed, `${area.kind} ${area.path} at level ${finer.depth}`),
          ).toHaveLength(1);
        }
      }
    }
  });

  it("numbers the levels from 1 and never repeats one", () => {
    for (const seed of SEEDS) {
      const levels = partitionLevels(inputOf(seed));
      const signatures = levels.map(({ areas }) =>
        areas
          .map(({ kind, path, paths }) => `${kind} ${path} ${paths.length}`)
          .join("\n"),
      );

      expect(
        levels.map(({ depth }) => depth),
        caseOf(seed, "depths"),
      ).toStrictEqual(levels.map((_, index) => index + 1));
      expect(new Set(signatures).size, caseOf(seed, "levels")).toBe(
        levels.length,
      );
    }
  });
});

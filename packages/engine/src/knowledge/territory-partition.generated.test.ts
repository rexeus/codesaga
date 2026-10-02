import { describe, expect, it } from "vitest";

import { partitionDetails } from "./territory-partition.js";
import type { PartitionInput } from "./territory-partition.js";

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

describe("partitionDetails over generated trees", () => {
  it("places every file in exactly one territory per detail", () => {
    for (const seed of SEEDS) {
      const input = inputOf(seed);
      for (const { detail, territories } of partitionDetails(input)) {
        expect(
          territories.flatMap(({ paths }) => paths).toSorted(),
          caseOf(seed, `detail ${detail}`),
        ).toStrictEqual(input.paths.toSorted());
      }
    }
  });

  // `other` territories are left out: they group the small territories of one parent, which may come from different territories of the detail above.
  it("nests every territory of a detail inside one territory of the detail above", () => {
    for (const seed of SEEDS) {
      const details = partitionDetails(inputOf(seed));
      for (const [index, finer] of details.slice(1).entries()) {
        const coarser = details[index]?.territories ?? [];
        for (const territory of finer.territories.filter(
          ({ kind }) => kind !== "other",
        )) {
          const homes = coarser.filter((candidate) =>
            territory.paths.every((path) => candidate.paths.includes(path)),
          );
          expect(
            homes,
            caseOf(
              seed,
              `${territory.kind} ${territory.path} at detail ${finer.detail}`,
            ),
          ).toHaveLength(1);
        }
      }
    }
  });

  it("numbers the details from 1 and never repeats one", () => {
    for (const seed of SEEDS) {
      const details = partitionDetails(inputOf(seed));
      const signatures = details.map(({ territories }) =>
        territories
          .map(({ kind, path, paths }) => `${kind} ${path} ${paths.length}`)
          .join("\n"),
      );

      expect(
        details.map(({ detail }) => detail),
        caseOf(seed, "depths"),
      ).toStrictEqual(details.map((_, index) => index + 1));
      expect(new Set(signatures).size, caseOf(seed, "details")).toBe(
        details.length,
      );
    }
  });
});

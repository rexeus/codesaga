import { describe, expect, it } from "vitest";

import { planSplit } from "./territory-tree.js";
import type { SplitContext, TreeTerritory } from "./territory-tree.js";

/** `count` files `<directory>/f0.ts`, `<directory>/f1.ts`, ... */
const filesIn = (directory: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `${directory}/f${index}.ts`);

const territoryOf = (
  path: string,
  paths: ReadonlyArray<string>,
  kind: TreeTerritory["kind"] = "package",
): TreeTerritory => ({ path, kind, paths });

/** Every file of the territory is expert-less unless `experts` says whose it is, by folder prefix. */
const contextOf = (
  totalFiles: number,
  experts: Readonly<Record<string, string>> = {},
): SplitContext => ({
  totalFiles,
  expertsOf: (path) => {
    const prefix = Object.keys(experts).find((folder) =>
      path.startsWith(`${folder}/`),
    );
    const expert = prefix === undefined ? undefined : experts[prefix];
    return expert === undefined ? [] : [expert];
  },
});

describe("planSplit by size", () => {
  // 40 files of 40: more than 30 files and more than 40% of all files
  const big = [
    ...filesIn("pkg/src", 25),
    ...filesIn("pkg/test", 12),
    ...filesIn("pkg", 3),
  ];

  it("splits a big territory into its folders, largest first, and keeps the loose files as other files", () => {
    const plan = planSplit(territoryOf("pkg", big), contextOf(40));

    expect(plan?.reason).toBe("big: 40 files");
    expect(plan?.expertiseGain).toBe(0);
    expect(
      plan?.folders.map(({ path, paths }) => [path, paths.length]),
    ).toStrictEqual([
      ["pkg/src", 25],
      ["pkg/test", 12],
    ]);
    expect(plan?.other).toStrictEqual(filesIn("pkg", 3));
  });

  it("keeps a territory of exactly 40% of the files whole", () => {
    // 10 of 25 files
    const ten = [...filesIn("pkg/src", 5), ...filesIn("pkg/test", 5)];

    expect(planSplit(territoryOf("pkg", ten), contextOf(25))).toBeUndefined();
    expect(planSplit(territoryOf("pkg", ten), contextOf(24))?.reason).toBe(
      "big: 10 files",
    );
  });

  it("takes a quarter of the files as the bound in between 30 and 150 files", () => {
    // 60 of 300 files is 20%, below the 40% share; the bound is min(150, max(30, 75)) = 75, and 60 stays under it
    const sixty = [...filesIn("pkg/src", 30), ...filesIn("pkg/test", 30)];
    const eighty = [...filesIn("pkg/src", 40), ...filesIn("pkg/test", 40)];

    expect(
      planSplit(territoryOf("pkg", sixty), contextOf(300)),
    ).toBeUndefined();
    expect(planSplit(territoryOf("pkg", eighty), contextOf(300))?.reason).toBe(
      "big: 80 files",
    );
  });

  it("never lets the bound exceed 150 files and never fall below 30", () => {
    const thirtyOne = [...filesIn("pkg/src", 16), ...filesIn("pkg/test", 15)];
    const hundredSixty = [
      ...filesIn("pkg/src", 80),
      ...filesIn("pkg/test", 80),
    ];

    expect(
      planSplit(territoryOf("pkg", thirtyOne), contextOf(100)),
    ).toBeDefined();
    expect(
      planSplit(territoryOf("pkg", thirtyOne.slice(1)), contextOf(100)),
    ).toBeUndefined();
    expect(
      planSplit(territoryOf("pkg", hundredSixty), contextOf(2000))?.reason,
    ).toBe("big: 160 files");
  });
});

const together = (...folders: ReadonlyArray<ReadonlyArray<string>>) =>
  folders.flat();

describe("planSplit with viable children", () => {
  it("needs at least two folders of 3 files", () => {
    const oneFolder = together(filesIn("pkg/src", 40), filesIn("pkg/docs", 2));

    expect(planSplit(territoryOf("pkg", oneFolder), contextOf(40))).toBe(
      undefined,
    );
  });

  it("counts a folder of 2 files among the other files", () => {
    const plan = planSplit(
      territoryOf(
        "pkg",
        together(
          filesIn("pkg/a", 20),
          filesIn("pkg/b", 20),
          filesIn("pkg/c", 2),
        ),
      ),
      contextOf(42),
    );

    expect(plan?.folders.map(({ path }) => path)).toStrictEqual([
      "pkg/a",
      "pkg/b",
    ]);
    expect(plan?.other).toStrictEqual(filesIn("pkg/c", 2));
  });

  it("looks inside the only folder with 3 files, leaving what lies beside it as other files", () => {
    const plan = planSplit(
      territoryOf(
        "pkg",
        together(
          filesIn("pkg/src/api", 20),
          filesIn("pkg/src/ui", 20),
          filesIn("pkg/src", 1),
          filesIn("pkg/docs", 2),
          filesIn("pkg", 1),
        ),
      ),
      contextOf(44),
    );

    expect(plan?.folders.map(({ path }) => path)).toStrictEqual([
      "pkg/src/api",
      "pkg/src/ui",
    ]);
    expect(plan?.other.toSorted()).toStrictEqual(
      [
        ...filesIn("pkg/src", 1),
        ...filesIn("pkg/docs", 2),
        ...filesIn("pkg", 1),
      ].toSorted(),
    );
  });
});

describe("planSplit of other files and the root package", () => {
  it("never splits other files", () => {
    const paths = together(filesIn("pkg/a", 40), filesIn("pkg/b", 40));

    expect(
      planSplit(territoryOf("pkg", paths, "other"), contextOf(80)),
    ).toBeUndefined();
  });

  it("splits the repository's root package below its own path", () => {
    const paths = together(filesIn("src", 20), filesIn("test", 20));

    expect(
      planSplit(territoryOf(".", paths), contextOf(40))?.folders.map(
        ({ path }) => path,
      ),
    ).toStrictEqual(["src", "test"]);
  });
});

describe("planSplit by expertise", () => {
  // three packages of 10 files in 30: none is big
  const paths = [...filesIn("pkg/src", 5), ...filesIn("pkg/test", 5)];

  it("splits folders whose main experts differ and names the two largest of them", () => {
    const plan = planSplit(
      territoryOf("pkg", paths),
      contextOf(30, { "pkg/src": "ada", "pkg/test": "grace" }),
    );

    expect(plan?.reason).toBe("pkg/src and pkg/test have different experts");
    expect(plan?.expertiseGain).toBe(1);
  });

  it("counts every distinct main expert beyond the first as a gain", () => {
    const plan = planSplit(
      territoryOf("pkg", [...paths, ...filesIn("pkg/docs", 3)]),
      contextOf(33, {
        "pkg/src": "ada",
        "pkg/test": "grace",
        "pkg/docs": "linus",
      }),
    );

    expect(plan?.expertiseGain).toBe(2);
  });

  it("does not split folders with the same main expert", () => {
    expect(
      planSplit(
        territoryOf("pkg", paths),
        contextOf(30, { "pkg/src": "ada", "pkg/test": "ada" }),
      ),
    ).toBeUndefined();
  });

  it("does not split when only one folder has a main expert", () => {
    expect(
      planSplit(territoryOf("pkg", paths), contextOf(30, { "pkg/src": "ada" })),
    ).toBeUndefined();
  });
});

describe("planSplit main experts", () => {
  // three packages of 10 files in 30: none is big
  const paths = [...filesIn("pkg/src", 5), ...filesIn("pkg/test", 5)];

  it("has no main expert in a folder where no one is an expert on half the files that have one", () => {
    // src: ada on 2 files, bob on 3 of 5 -> main bob, 60%; test: ada 2, bob 2, cy 1 -> ada and bob tie on 2 of 5, 40%
    const experts: Record<string, ReadonlyArray<string>> = {
      "pkg/src/f0.ts": ["bob"],
      "pkg/src/f1.ts": ["bob"],
      "pkg/src/f2.ts": ["bob"],
      "pkg/src/f3.ts": ["ada"],
      "pkg/src/f4.ts": ["ada"],
      "pkg/test/f0.ts": ["ada"],
      "pkg/test/f1.ts": ["ada"],
      "pkg/test/f2.ts": ["bob"],
      "pkg/test/f3.ts": ["bob"],
      "pkg/test/f4.ts": ["cy"],
    };

    const plan = planSplit(territoryOf("pkg", paths), {
      totalFiles: 30,
      expertsOf: (path) => experts[path] ?? [],
    });

    expect(plan).toBeUndefined();
  });

  it("prefers the expertise reason when the territory is also big", () => {
    const plan = planSplit(
      territoryOf("pkg", [
        ...filesIn("pkg/src", 20),
        ...filesIn("pkg/test", 20),
      ]),
      contextOf(40, { "pkg/src": "ada", "pkg/test": "grace" }),
    );

    expect(plan?.reason).toBe("pkg/src and pkg/test have different experts");
  });
});

import { describe, expect, it } from "vitest";

import { territoriesAtDetail } from "./territories.js";
import { partitionTerritories } from "./territory-partition.js";
import type {
  PartitionInput,
  PartitionTerritory,
} from "./territory-partition.js";

/** `count` files `<directory>/f0.ts`, `<directory>/f1.ts`, ... */
const filesIn = (directory: string, count: number): ReadonlyArray<string> =>
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

const partition = (
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
const summarize = (
  territories: ReadonlyArray<PartitionTerritory>,
): ReadonlyArray<string> =>
  territories.map(({ kind, path, paths }) => `${kind} ${path} ${paths.length}`);

// 27 files: three packages, a scripts directory and root files. No package is big or has experts.
const monorepo = [
  "apps/ui/index.ts",
  "apps/ui/src/test.ts",
  "apps/ui/src/a.ts",
  ...filesIn("apps/ui/src/components", 3),
  "apps/api/index.ts",
  "apps/api/src/main.ts",
  ...filesIn("apps/api/src/routes", 3),
  ...filesIn("packages/db/src", 10),
  ...filesIn("scripts", 3),
  "index.ts",
  "config.ts",
  "docs/a.ts",
];
const monorepoRoots = [".", "apps/api", "apps/ui", "packages/db"];

describe("partitionTerritories first cut", () => {
  const { territories, maxDetail } = partition(monorepo, monorepoRoots);

  it("makes the package roots and the top-level folders outside them the first cut, with the small leftovers last", () => {
    expect(summarize(territories)).toStrictEqual([
      "package apps/api 5",
      "package apps/ui 6",
      "package packages/db 10",
      "folder scripts 3",
      "other . 3",
    ]);
  });

  it("keeps a file directly in a package root in that package's territory", () => {
    const ui = territories.find(({ path }) => path === "apps/ui");

    expect(ui?.paths).toContain("apps/ui/index.ts");
    expect(ui?.paths).toContain("apps/ui/src/test.ts");
  });

  it("has a single detail when nothing is big and no folders have different experts", () => {
    expect(maxDetail).toBe(1);
  });
});

describe("partitionTerritories first cut leftovers and scope", () => {
  it("groups the files of a package or folder under 3 files, and root files, as the scope's other files", () => {
    const { territories: cut } = partition(
      [...filesIn("apps/web", 3), ...filesIn("tools", 2), "main.ts"],
      ["apps/web"],
    );

    expect(summarize(cut)).toStrictEqual(["package apps/web 3", "other . 3"]);
  });

  it("cuts the top-level directories where there are no packages", () => {
    const { territories: cut } = partition(
      [
        "src/index.ts",
        ...filesIn("src/a", 3),
        ...filesIn("tests", 3),
        ...filesIn("docs", 3),
        "root.ts",
      ],
      [],
    );

    expect(summarize(cut)).toStrictEqual([
      "folder docs 3",
      "folder src 4",
      "folder tests 3",
      "other . 1",
    ]);
  });

  it("anchors the first cut below the scope for a scoped analysis", () => {
    const { territories: cut } = partition(
      [
        ...filesIn("packages/x/src", 3),
        ...filesIn("packages/x/test", 3),
        "packages/x/index.ts",
      ],
      [],
      { scope: "packages/x" },
    );

    expect(summarize(cut)).toStrictEqual([
      "folder packages/x/src 3",
      "folder packages/x/test 3",
      "other packages/x 1",
    ]);
  });
});

describe("partitionTerritories package roots", () => {
  it("makes the scope's own package the only territory of a flat repository", () => {
    expect(
      summarize(partition(["a.ts", "b.ts", "c.ts"], ["."]).territories),
    ).toStrictEqual(["package . 3"]);
  });

  it("assigns a file to its nearest package root", () => {
    const { territories } = partition(
      [...filesIn("packages/a", 3), ...filesIn("packages/a/fixtures/b", 3)],
      ["packages/a", "packages/a/fixtures/b"],
    );

    expect(summarize(territories)).toStrictEqual([
      "package packages/a 3",
      "package packages/a/fixtures/b 3",
    ]);
  });

  it("ignores a package root that holds no universe file", () => {
    expect(
      summarize(
        partition(["a.ts", "b.ts", "c.ts"], [".", "vendor/lib"]).territories,
      ),
    ).toStrictEqual(["package . 3"]);
  });
});

describe("partitionTerritories extremes", () => {
  it("returns no territory and detail 1 for no files", () => {
    expect(partition([], ["."])).toStrictEqual({
      territories: [],
      maxDetail: 1,
      expertiseDetail: 1,
    });
  });

  it("makes a scope that is a file one folder territory, that file", () => {
    expect(
      partition(["packages/lib/x.ts"], [], { scope: "packages/lib/x.ts" }),
    ).toStrictEqual({
      territories: [
        {
          path: "packages/lib/x.ts",
          kind: "folder",
          paths: ["packages/lib/x.ts"],
          territories: [],
        },
      ],
      maxDetail: 1,
      expertiseDetail: 1,
    });
  });
});

describe("partitionTerritories splits", () => {
  // 40 files: lib is big (40 > 30, 100% of the files) and splits by size
  const single = [
    ...filesIn("src/core", 20),
    ...filesIn("src/util", 12),
    ...filesIn("test", 5),
    "main.ts",
    "index.ts",
    "config.ts",
  ];

  it("splits a big package into its folders and its loose files, and gives the split its reason and detail", () => {
    const { territories } = partition(single, ["."]);
    const [root] = territories;

    expect(summarize(territories)).toStrictEqual(["package . 40"]);
    expect(root).toMatchObject({
      splitReason: "big: 40 files",
      splitDetail: 2,
    });
    expect(summarize(root?.territories ?? [])).toStrictEqual([
      "folder src 32",
      "folder test 5",
      "other . 3",
    ]);
  });

  it("keeps splitting a child that is big itself", () => {
    // src (32 of 40 files) is big and holds two folders of 3 files or more
    const { territories } = partition(single, ["."]);
    const src = territories[0]?.territories.find(({ path }) => path === "src");

    expect(src).toMatchObject({ splitReason: "big: 32 files", splitDetail: 3 });
    expect(summarize(src?.territories ?? [])).toStrictEqual([
      "folder src/core 20",
      "folder src/util 12",
    ]);
  });

  it("shows the first cut at detail 1 and each split from its detail on, covering every file once", () => {
    const { territories, maxDetail } = partition(single, ["."]);

    expect(maxDetail).toBe(3);
    expect(
      [1, 2, 3].map((detail) =>
        summarize(territoriesAtDetail(territories, detail)),
      ),
    ).toStrictEqual([
      ["package . 40"],
      ["folder src 32", "folder test 5", "other . 3"],
      [
        "folder src/core 20",
        "folder src/util 12",
        "folder test 5",
        "other . 3",
      ],
    ]);
  });
});

describe("partitionTerritories order of splits", () => {
  // p holds 60 of 84 files and splits by size; q holds 24 and splits by experts
  const paths = [
    ...filesIn("p/a", 30),
    ...filesIn("p/b", 30),
    ...filesIn("q/a", 12),
    ...filesIn("q/b", 12),
  ];
  const experts = { "q/a": "ada", "q/b": "grace" };

  it("opens a split by expertise before a split by size and records the last such detail", () => {
    const { territories, maxDetail, expertiseDetail } = partition(
      paths,
      ["p", "q"],
      { experts },
    );

    expect(
      territories.map(({ path, splitReason, splitDetail }) => [
        path,
        splitReason,
        splitDetail,
      ]),
    ).toStrictEqual([
      ["p", "big: 60 files", 3],
      ["q", "q/a and q/b have different experts", 2],
    ]);
    expect(maxDetail).toBe(3);
    expect(expertiseDetail).toBe(2);
  });
});

describe("partitionTerritories value of splits", () => {
  it("opens the split with more distinct experts first", () => {
    const { territories } = partition(
      [
        ...filesIn("p/a", 6),
        ...filesIn("p/b", 6),
        ...filesIn("q/a", 6),
        ...filesIn("q/b", 6),
        ...filesIn("q/c", 6),
      ],
      ["p", "q"],
      {
        experts: {
          "p/a": "ada",
          "p/b": "grace",
          "q/a": "ada",
          "q/b": "grace",
          "q/c": "linus",
        },
      },
    );

    expect(
      territories.map(({ path, splitDetail }) => [path, splitDetail]),
    ).toStrictEqual([
      ["p", 3],
      ["q", 2],
    ]);
  });

  it("opens the larger of two equally valuable splits first", () => {
    const { territories } = partition(
      [
        ...filesIn("p/a", 4),
        ...filesIn("p/b", 4),
        ...filesIn("q/a", 6),
        ...filesIn("q/b", 6),
      ],
      ["p", "q"],
      {
        experts: { "p/a": "ada", "p/b": "grace", "q/a": "ada", "q/b": "grace" },
      },
    );

    expect(
      territories.map(({ path, splitDetail }) => [path, splitDetail]),
    ).toStrictEqual([
      ["p", 3],
      ["q", 2],
    ]);
  });
});

describe("partitionTerritories details of splits", () => {
  it("spreads the splits evenly over the details in order and stops at detail 6", () => {
    // seven packages of 10 files, each with two folders of different experts and equal value: opened by path
    const names = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
    const { territories, maxDetail } = partition(
      names.flatMap((name) => [
        ...filesIn(`${name}/a`, 5),
        ...filesIn(`${name}/b`, 5),
      ]),
      names,
      {
        experts: Object.fromEntries(
          names.flatMap((name) => [
            [`${name}/a`, "ada"],
            [`${name}/b`, "grace"],
          ]),
        ),
      },
    );

    expect(maxDetail).toBe(6);
    expect(territories.map(({ splitDetail }) => splitDetail)).toStrictEqual([
      2, 2, 3, 4, 4, 5, 6,
    ]);
  });
});

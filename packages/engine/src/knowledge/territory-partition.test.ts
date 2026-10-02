import { describe, expect, it } from "vitest";

import { partitionDetails } from "./territory-partition.js";

/** `count` files `<directory>/f0.ts`, `<directory>/f1.ts`, ... */
const filesIn = (directory: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `${directory}/f${index}.ts`);

/** Each territory of a detail as `kind path files`, in the detail's order. */
const summarize = (
  detail: ReturnType<typeof partitionDetails>[number],
): ReadonlyArray<string> =>
  detail.territories.map(
    ({ kind, path, paths }) => `${kind} ${path} ${paths.length}`,
  );

// 27 files: three packages, a scripts directory and root files.
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

describe("partitionDetails in a repository with packages", () => {
  const details = partitionDetails({
    paths: monorepo,
    packageRoots: monorepoRoots,
    scope: ".",
  });

  it("makes detail 1 the package roots and keeps a package's files in one territory", () => {
    expect(summarize(details[0])).toStrictEqual([
      "other . 3",
      "package apps/api 5",
      "package apps/ui 6",
      "package packages/db 10",
      "folder scripts 3",
    ]);
    const ui = details[0].territories.find(({ path }) => path === "apps/ui");
    expect(ui?.paths).toContain("apps/ui/index.ts");
    expect(ui?.paths).toContain("apps/ui/src/test.ts");
  });

  it("cuts one directory step deeper per detail and groups territories under 3 files per parent", () => {
    expect(details.map((detail) => summarize(detail))[1]).toStrictEqual([
      "other . 3",
      "other apps 2",
      "folder apps/api/src 4",
      "folder apps/ui/src 5",
      "folder packages/db/src 10",
      "folder scripts 3",
    ]);
    expect(details.map((detail) => summarize(detail))[2]).toStrictEqual([
      "other . 3",
      "other apps 2",
      "other apps/api 1",
      "folder apps/api/src/routes 3",
      "other apps/ui 2",
      "folder apps/ui/src/components 3",
      "folder packages/db/src 10",
      "folder scripts 3",
    ]);
  });

  it("stops at the detail after which no territory changes", () => {
    expect(details.map(({ detail }) => detail)).toStrictEqual([1, 2, 3]);
  });

  it("puts every universe file into exactly one territory at every detail", () => {
    for (const detail of details) {
      const placed = detail.territories.flatMap(({ paths }) => paths);
      expect(placed.toSorted()).toStrictEqual(monorepo.toSorted());
    }
  });
});

describe("partitionDetails without packages", () => {
  const paths = [
    "src/index.ts",
    ...filesIn("src/a", 3),
    ...filesIn("tests", 3),
    ...filesIn("docs", 3),
    ...filesIn("lib", 3),
    "root.ts",
  ];

  it("makes detail 1 the top-level directories and detail 2 one step deeper", () => {
    const details = partitionDetails({ paths, packageRoots: [], scope: "." });

    expect(details.map((detail) => summarize(detail))).toStrictEqual([
      [
        "other . 1",
        "folder docs 3",
        "folder lib 3",
        "folder src 4",
        "folder tests 3",
      ],
      [
        "other . 2",
        "folder docs 3",
        "folder lib 3",
        "folder src/a 3",
        "folder tests 3",
      ],
    ]);
  });
});

describe("partitionDetails below the scope and at the extremes", () => {
  it("anchors the details below the scope for a scoped analysis", () => {
    const [detail] = partitionDetails({
      paths: [
        ...filesIn("packages/x/src", 3),
        ...filesIn("packages/x/test", 3),
        "packages/x/index.ts",
      ],
      packageRoots: [],
      scope: "packages/x",
    });

    expect(summarize(detail)).toStrictEqual([
      "other packages/x 1",
      "folder packages/x/src 3",
      "folder packages/x/test 3",
    ]);
  });

  it("returns detail 1 with no territories for no files", () => {
    expect(
      partitionDetails({ paths: [], packageRoots: ["."], scope: "." }),
    ).toStrictEqual([{ detail: 1, territories: [] }]);
  });

  it("stops at detail 6 in a deeper tree", () => {
    const deep = ["d1", "d2", "d3", "d4"].flatMap((top) =>
      filesIn(`${top}/a/b/c/d/e/f/g`, 3),
    );
    const details = partitionDetails({
      paths: deep,
      packageRoots: [],
      scope: ".",
    });

    expect(details).toHaveLength(6);
    expect(details[5]?.territories.map(({ path }) => path)).toStrictEqual([
      "d1/a/b/c/d/e",
      "d2/a/b/c/d/e",
      "d3/a/b/c/d/e",
      "d4/a/b/c/d/e",
    ]);
  });
});

describe("partitionDetails package roots", () => {
  it("makes the scope's own package the only territory of a flat repository", () => {
    const [detail] = partitionDetails({
      paths: ["a.ts", "b.ts", "c.ts"],
      packageRoots: ["."],
      scope: ".",
    });

    expect(summarize(detail)).toStrictEqual(["package . 3"]);
  });

  it("assigns a file to its nearest package root", () => {
    const [detail] = partitionDetails({
      paths: [
        ...filesIn("packages/a", 3),
        ...filesIn("packages/a/fixtures/b", 3),
      ],
      packageRoots: ["packages/a", "packages/a/fixtures/b"],
      scope: ".",
    });

    expect(summarize(detail)).toStrictEqual([
      "package packages/a 3",
      "package packages/a/fixtures/b 3",
    ]);
  });

  it("ignores a package root that holds no universe file", () => {
    const [detail] = partitionDetails({
      paths: ["a.ts", "b.ts", "c.ts"],
      packageRoots: [".", "vendor/lib"],
      scope: ".",
    });

    expect(summarize(detail)).toStrictEqual(["package . 3"]);
  });
});

describe("partitionDetails with a giant territory", () => {
  // 22 files: packages/core holds 14 (64%), with 9 in src (41%).
  const paths = [
    "packages/core/index.ts",
    ...filesIn("packages/core/src/a", 5),
    ...filesIn("packages/core/src/b", 4),
    ...filesIn("packages/core/test", 4),
    ...filesIn("packages/ui/src", 4),
    ...filesIn("packages/db/src", 4),
  ];
  const details = partitionDetails({
    paths,
    packageRoots: ["packages/core", "packages/db", "packages/ui"],
    scope: ".",
  });

  it("splits a territory above 40% of the files once when that yields two territories of at least 3 files", () => {
    expect(summarize(details[0])).toStrictEqual([
      "other packages 1",
      "folder packages/core/src 9",
      "folder packages/core/test 4",
      "package packages/db 4",
      "package packages/ui 4",
    ]);
  });

  it("cuts the packages beside the giant one step deeper at the next detail, and splits the giant src", () => {
    expect(details.map((detail) => summarize(detail))[1]).toStrictEqual([
      "other packages 1",
      "folder packages/core/src/a 5",
      "folder packages/core/src/b 4",
      "folder packages/core/test 4",
      "folder packages/db/src 4",
      "folder packages/ui/src 4",
    ]);
  });

  it("drops a detail that has the same territories as the one before", () => {
    expect(details).toHaveLength(2);
  });
});

/** Detail 1 of 25 files: a package of `giantFiles` (src 5, test the rest) beside two packages of the other files. */
const detailOneWithGiant = (giantFiles: number) => {
  const others = 25 - giantFiles;
  const [detail] = partitionDetails({
    paths: [
      ...filesIn("packages/big/src", 5),
      ...filesIn("packages/big/test", giantFiles - 5),
      ...filesIn("packages/p2", Math.ceil(others / 2)),
      ...filesIn("packages/p3", Math.floor(others / 2)),
    ],
    packageRoots: ["packages/big", "packages/p2", "packages/p3"],
    scope: ".",
  });
  return summarize(detail);
};

describe("partitionDetails at the share of a giant territory", () => {
  it("keeps a territory of exactly 40% of the files whole", () => {
    expect(detailOneWithGiant(10)).toStrictEqual([
      "package packages/big 10",
      "package packages/p2 8",
      "package packages/p3 7",
    ]);
  });

  it("splits a territory just above 40% of the files", () => {
    expect(detailOneWithGiant(11)).toStrictEqual([
      "folder packages/big/src 5",
      "folder packages/big/test 6",
      "package packages/p2 7",
      "package packages/p3 7",
    ]);
  });
});

describe("partitionDetails splitting a giant territory further", () => {
  it("splits a single package into its src and test directories at detail 1", () => {
    const [detail] = partitionDetails({
      paths: [
        ...filesIn("src/core", 4),
        ...filesIn("src/util", 3),
        ...filesIn("test", 5),
        "main.ts",
        "index.ts",
        "config.ts",
      ],
      packageRoots: ["."],
      scope: ".",
    });

    expect(summarize(detail)).toStrictEqual([
      "package . 3",
      "folder src 7",
      "folder test 5",
    ]);
  });

  it("keeps splitting while a split leaves only one territory of 3 files, at most two steps", () => {
    const [detail] = partitionDetails({
      paths: [
        "packages/core/index.ts",
        ...filesIn("packages/core/src/a/deep/er", 4),
        ...filesIn("packages/core/src/a/b", 4),
        ...filesIn("packages/ui", 5),
      ],
      packageRoots: ["packages/core", "packages/ui"],
      scope: ".",
    });

    expect(summarize(detail)).toStrictEqual([
      "other packages 1",
      "folder packages/core/src/a 8",
      "package packages/ui 5",
    ]);
  });
});

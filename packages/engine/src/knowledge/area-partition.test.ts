import { describe, expect, it } from "vitest";

import { partitionLevels } from "./area-partition.js";

/** `count` files `<directory>/f0.ts`, `<directory>/f1.ts`, ... */
const filesIn = (directory: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `${directory}/f${index}.ts`);

/** Each area of a level as `kind path files`, in the level's order. */
const summarize = (
  level: ReturnType<typeof partitionLevels>[number],
): ReadonlyArray<string> =>
  level.areas.map(({ kind, path, paths }) => `${kind} ${path} ${paths.length}`);

// 27 files: three packages, a scripts directory and loose root files.
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

describe("partitionLevels in a repository with packages", () => {
  const levels = partitionLevels({
    paths: monorepo,
    packageRoots: monorepoRoots,
    scope: ".",
  });

  it("makes level 1 the package roots and keeps a package's files in one area", () => {
    expect(summarize(levels[0])).toStrictEqual([
      "rest . 3",
      "package apps/api 5",
      "package apps/ui 6",
      "package packages/db 10",
      "directory scripts 3",
    ]);
    const ui = levels[0].areas.find(({ path }) => path === "apps/ui");
    expect(ui?.paths).toContain("apps/ui/index.ts");
    expect(ui?.paths).toContain("apps/ui/src/test.ts");
  });

  it("cuts one directory step deeper per level and groups areas under 3 files per parent", () => {
    expect(levels.map((level) => summarize(level))[1]).toStrictEqual([
      "rest . 3",
      "rest apps 2",
      "directory apps/api/src 4",
      "directory apps/ui/src 5",
      "directory packages/db/src 10",
      "directory scripts 3",
    ]);
    expect(levels.map((level) => summarize(level))[2]).toStrictEqual([
      "rest . 3",
      "rest apps 2",
      "rest apps/api 1",
      "directory apps/api/src/routes 3",
      "rest apps/ui 2",
      "directory apps/ui/src/components 3",
      "directory packages/db/src 10",
      "directory scripts 3",
    ]);
  });

  it("stops at the level after which no area changes", () => {
    expect(levels.map(({ depth }) => depth)).toStrictEqual([1, 2, 3]);
  });

  it("puts every universe file into exactly one area at every level", () => {
    for (const level of levels) {
      const placed = level.areas.flatMap(({ paths }) => paths);
      expect(placed.toSorted()).toStrictEqual(monorepo.toSorted());
    }
  });
});

describe("partitionLevels without packages", () => {
  const paths = [
    "src/index.ts",
    ...filesIn("src/a", 3),
    ...filesIn("tests", 3),
    ...filesIn("docs", 3),
    ...filesIn("lib", 3),
    "root.ts",
  ];

  it("makes level 1 the top-level directories and level 2 one step deeper", () => {
    const levels = partitionLevels({ paths, packageRoots: [], scope: "." });

    expect(levels.map((level) => summarize(level))).toStrictEqual([
      [
        "rest . 1",
        "directory docs 3",
        "directory lib 3",
        "directory src 4",
        "directory tests 3",
      ],
      [
        "rest . 2",
        "directory docs 3",
        "directory lib 3",
        "directory src/a 3",
        "directory tests 3",
      ],
    ]);
  });
});

describe("partitionLevels below the scope and at the extremes", () => {
  it("anchors the levels below the scope for a scoped analysis", () => {
    const [level] = partitionLevels({
      paths: [
        ...filesIn("packages/x/src", 3),
        ...filesIn("packages/x/test", 3),
        "packages/x/index.ts",
      ],
      packageRoots: [],
      scope: "packages/x",
    });

    expect(summarize(level)).toStrictEqual([
      "rest packages/x 1",
      "directory packages/x/src 3",
      "directory packages/x/test 3",
    ]);
  });

  it("returns level 1 with no areas for no files", () => {
    expect(
      partitionLevels({ paths: [], packageRoots: ["."], scope: "." }),
    ).toStrictEqual([{ depth: 1, areas: [] }]);
  });

  it("stops at level 6 in a deeper tree", () => {
    const deep = ["d1", "d2", "d3", "d4"].flatMap((top) =>
      filesIn(`${top}/a/b/c/d/e/f/g`, 3),
    );
    const levels = partitionLevels({
      paths: deep,
      packageRoots: [],
      scope: ".",
    });

    expect(levels).toHaveLength(6);
    expect(levels[5]?.areas.map(({ path }) => path)).toStrictEqual([
      "d1/a/b/c/d/e",
      "d2/a/b/c/d/e",
      "d3/a/b/c/d/e",
      "d4/a/b/c/d/e",
    ]);
  });
});

describe("partitionLevels package roots", () => {
  it("makes the scope's own package the only area of a flat repository", () => {
    const [level] = partitionLevels({
      paths: ["a.ts", "b.ts", "c.ts"],
      packageRoots: ["."],
      scope: ".",
    });

    expect(summarize(level)).toStrictEqual(["package . 3"]);
  });

  it("assigns a file to its nearest package root", () => {
    const [level] = partitionLevels({
      paths: [
        ...filesIn("packages/a", 3),
        ...filesIn("packages/a/fixtures/b", 3),
      ],
      packageRoots: ["packages/a", "packages/a/fixtures/b"],
      scope: ".",
    });

    expect(summarize(level)).toStrictEqual([
      "package packages/a 3",
      "package packages/a/fixtures/b 3",
    ]);
  });

  it("ignores a package root that holds no universe file", () => {
    const [level] = partitionLevels({
      paths: ["a.ts", "b.ts", "c.ts"],
      packageRoots: [".", "vendor/lib"],
      scope: ".",
    });

    expect(summarize(level)).toStrictEqual(["package . 3"]);
  });
});

describe("partitionLevels with a giant area", () => {
  // 22 files: packages/core holds 14 (64%), with 9 in src (41%).
  const paths = [
    "packages/core/index.ts",
    ...filesIn("packages/core/src/a", 5),
    ...filesIn("packages/core/src/b", 4),
    ...filesIn("packages/core/test", 4),
    ...filesIn("packages/ui/src", 4),
    ...filesIn("packages/db/src", 4),
  ];
  const levels = partitionLevels({
    paths,
    packageRoots: ["packages/core", "packages/db", "packages/ui"],
    scope: ".",
  });

  it("splits an area above 40% of the files, down to two directories further", () => {
    expect(summarize(levels[0])).toStrictEqual([
      "rest packages 1",
      "directory packages/core/src/a 5",
      "directory packages/core/src/b 4",
      "directory packages/core/test 4",
      "package packages/db 4",
      "package packages/ui 4",
    ]);
  });

  it("cuts the packages beside the giant one step deeper at the next level, while the giant stays split", () => {
    expect(levels.map((level) => summarize(level))[1]).toStrictEqual([
      "rest packages 1",
      "directory packages/core/src/a 5",
      "directory packages/core/src/b 4",
      "directory packages/core/test 4",
      "directory packages/db/src 4",
      "directory packages/ui/src 4",
    ]);
  });

  it("drops a level that has the same areas as the one before", () => {
    expect(levels).toHaveLength(2);
  });
});

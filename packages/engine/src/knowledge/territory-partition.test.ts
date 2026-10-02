import { describe, expect, it } from "vitest";

import {
  filesIn,
  partition,
  summarize,
} from "../testing/territory-partition.js";

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

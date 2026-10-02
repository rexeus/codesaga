import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import type { ClassifiedCommit } from "../automation/classify.js";
import { at, classifiedCommit } from "../testing/classified-commit.js";
import { knowledgeModel } from "./model.js";
import { territoriesAtDetail, territoryTree } from "./territories.js";

const now = DateTime.makeUnsafe("2026-03-01T00:00:00Z");
const ada = { name: "Ada", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };

const touching = (
  time: string,
  paths: ReadonlyArray<string>,
  author: ClassifiedCommit["author"],
): ClassifiedCommit =>
  classifiedCommit({
    time: at(time),
    author,
    changes: paths.map((path) => ({ path, added: 10, deleted: 0 })),
  });

const filesIn = (directory: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `${directory}/f${index}.ts`);

const treeOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
  paths: ReadonlyArray<string>,
  packageRoots: ReadonlyArray<string>,
) =>
  territoryTree({
    paths,
    packageRoots,
    scope: ".",
    model: knowledgeModel({
      commits,
      universe: paths.map((path) => ({ path, loc: 50 })),
      headTime: at("2026-02-01T00:00:00Z"),
      now,
    }),
  });

const web = filesIn("apps/web", 4);
const lib = filesIn("packages/lib", 4);

describe("territoryTree knowledge", () => {
  it("describes each territory by the experts of its own files", () => {
    const { territories } = treeOf(
      [
        touching("2026-02-20T00:00:00Z", web, ada),
        touching("2026-02-19T00:00:00Z", lib, grace),
      ],
      [...web, ...lib],
      ["apps/web", "packages/lib"],
    );

    expect(
      territories.map(({ path, kind, files, island, experts }) => ({
        path,
        kind,
        files,
        island,
        experts: experts.map(({ email, files: expertFiles }) => [
          email,
          expertFiles,
        ]),
      })),
    ).toStrictEqual([
      {
        path: "apps/web",
        kind: "package",
        files: 4,
        island: true,
        experts: [["ada@example.com", 4]],
      },
      {
        path: "packages/lib",
        kind: "package",
        files: 4,
        island: true,
        experts: [["grace@example.com", 4]],
      },
    ]);
  });
});

describe("territoryTree order", () => {
  it("lists orphaned territories first, then the healthy ones, and the small territories last", () => {
    const old = filesIn("apps/old", 3);
    const scripts = ["scripts/a.ts", "scripts/b.ts"];
    const { territories } = treeOf(
      [
        touching("2026-02-21T00:00:00Z", web, ada),
        touching("2026-02-20T00:00:00Z", web, grace),
        touching("2025-01-01T00:00:00Z", old, grace),
        touching("2025-01-02T00:00:00Z", scripts, ada),
      ],
      [...web, ...old, ...scripts],
      ["apps/web", "apps/old"],
    );

    expect(
      territories.map(({ kind, path }) => `${kind} ${path}`),
    ).toStrictEqual(["package apps/old", "package apps/web", "other ."]);
  });
});

describe("territoryTree other-files territories", () => {
  const old = filesIn("apps/old", 3);
  const otherFilesOf = (scripts: ReadonlyArray<string>) => {
    const { territories } = treeOf(
      [
        touching("2026-02-21T00:00:00Z", web, ada),
        touching("2025-01-01T00:00:00Z", old, grace),
        touching("2025-01-02T00:00:00Z", scripts, grace),
      ],
      [...web, ...old, ...scripts],
      ["apps/web", "apps/old"],
    );
    return territories.find(({ kind }) => kind === "other");
  };

  it("flags no island and no orphaned knowledge for fewer than 3 files", () => {
    // two files, sole expert Grace, no active expert: a directory would be both
    expect(otherFilesOf(["scripts/a.ts", "tools/b.ts"])).toMatchObject({
      files: 2,
      island: false,
      orphaned: false,
      reasons: [],
    });
  });

  it("flags them once the grouped files reach 3", () => {
    expect(
      otherFilesOf(["scripts/a.ts", "scripts/b.ts", "tools/c.ts"]),
    ).toMatchObject({
      files: 3,
      island: true,
      orphaned: true,
    });
  });
});

const core = [
  ...filesIn("packages/core/src", 5),
  ...filesIn("packages/core/test", 5),
];
const other = filesIn("packages/lib", 10);
const paths = [...core, ...other, ...filesIn("packages/cli", 10)];
const splitTree = treeOf(
  [
    touching("2026-02-20T00:00:00Z", filesIn("packages/core/src", 5), ada),
    touching("2026-02-19T00:00:00Z", filesIn("packages/core/test", 5), grace),
    touching("2026-02-18T00:00:00Z", other, ada),
    touching("2026-02-17T00:00:00Z", filesIn("packages/cli", 10), ada),
  ],
  paths,
  ["packages/core", "packages/lib", "packages/cli"],
);

describe("territoryTree splits", () => {
  it("describes a split territory by all its files and its children by their own", () => {
    const split = splitTree.territories.find(
      ({ path }) => path === "packages/core",
    );

    expect(split).toMatchObject({
      files: 10,
      splitReason:
        "packages/core/src and packages/core/test have different experts",
      splitDetail: 2,
      totalTerritories: 2,
    });
    expect(
      split?.territories.map(({ path, files, experts }) => [
        path,
        files,
        experts.map(({ email }) => email),
      ]),
    ).toStrictEqual([
      ["packages/core/src", 5, ["ada@example.com"]],
      ["packages/core/test", 5, ["grace@example.com"]],
    ]);
  });

  it("leaves territories without a split childless and without a reason", () => {
    const whole = splitTree.territories.find(
      ({ path }) => path === "packages/lib",
    );

    expect(whole).toMatchObject({ territories: [], totalTerritories: 0 });
    expect(whole).not.toHaveProperty("splitReason");
    expect(whole).not.toHaveProperty("splitDetail");
  });

  it("shows the first cut at detail 1 and the split territory's children from detail 2", () => {
    expect(splitTree.maxDetail).toBe(2);
    expect(splitTree.expertiseDetail).toBe(2);
    expect(
      [1, 2].map((detail) =>
        territoriesAtDetail(splitTree.territories, detail)
          .map(({ path }) => path)
          .toSorted(),
      ),
    ).toStrictEqual([
      ["packages/cli", "packages/core", "packages/lib"],
      [
        "packages/cli",
        "packages/core/src",
        "packages/core/test",
        "packages/lib",
      ],
    ]);
  });
});

import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import type { ClassifiedCommit } from "../automation/classify.js";
import { at, classifiedCommit } from "../testing/classified-commit.js";
import { areaLevels } from "./areas.js";
import { knowledgeModel } from "./model.js";

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

const levelsOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
  paths: ReadonlyArray<string>,
  packageRoots: ReadonlyArray<string>,
) =>
  areaLevels({
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

describe("areaLevels knowledge", () => {
  it("describes each area by the experts of its own files", () => {
    const [level] = levelsOf(
      [
        touching("2026-02-20T00:00:00Z", web, ada),
        touching("2026-02-19T00:00:00Z", lib, grace),
      ],
      [...web, ...lib],
      ["apps/web", "packages/lib"],
    );

    expect(
      level.areas.map(({ path, kind, files, island, experts }) => ({
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

describe("areaLevels order and counts", () => {
  it("lists orphaned areas first, then the healthy ones, and the small areas last", () => {
    const old = filesIn("apps/old", 3);
    const loose = ["scripts/a.ts", "scripts/b.ts"];
    const [level] = levelsOf(
      [
        touching("2026-02-21T00:00:00Z", web, ada),
        touching("2026-02-20T00:00:00Z", web, grace),
        touching("2025-01-01T00:00:00Z", old, grace),
        touching("2025-01-02T00:00:00Z", loose, ada),
      ],
      [...web, ...old, ...loose],
      ["apps/web", "apps/old"],
    );

    expect(
      level.areas.map(({ kind, path }) => `${kind} ${path}`),
    ).toStrictEqual(["package apps/old", "package apps/web", "rest ."]);
  });

  it("counts the areas of every level, a level deeper having more", () => {
    const paths = [
      "apps/web/index.ts",
      ...filesIn("apps/web/src", 3),
      ...filesIn("packages/lib", 3),
      ...filesIn("packages/cli", 3),
    ];
    const levels = levelsOf(
      [touching("2026-02-20T00:00:00Z", paths, ada)],
      paths,
      ["apps/web", "packages/lib", "packages/cli"],
    );

    expect(
      levels.map(({ depth, totalAreas, areas }) => [
        depth,
        totalAreas,
        areas.length,
      ]),
    ).toStrictEqual([
      [1, 3, 3],
      [2, 4, 4],
    ]);
  });
});

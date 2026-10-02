import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import type { ClassifiedCommit } from "../automation/classify.js";
import { at, classifiedCommit } from "../testing/classified-commit.js";
import { knowledgeModel } from "./model.js";
import { territoryDetails } from "./territories.js";

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

const detailsOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
  paths: ReadonlyArray<string>,
  packageRoots: ReadonlyArray<string>,
) =>
  territoryDetails({
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

describe("territoryDetails knowledge", () => {
  it("describes each territory by the experts of its own files", () => {
    const [detail] = detailsOf(
      [
        touching("2026-02-20T00:00:00Z", web, ada),
        touching("2026-02-19T00:00:00Z", lib, grace),
      ],
      [...web, ...lib],
      ["apps/web", "packages/lib"],
    );

    expect(
      detail.territories.map(({ path, kind, files, island, experts }) => ({
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

describe("territoryDetails order and counts", () => {
  it("lists orphaned territories first, then the healthy ones, and the small territories last", () => {
    const old = filesIn("apps/old", 3);
    const scripts = ["scripts/a.ts", "scripts/b.ts"];
    const [detail] = detailsOf(
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
      detail.territories.map(({ kind, path }) => `${kind} ${path}`),
    ).toStrictEqual(["package apps/old", "package apps/web", "other ."]);
  });

  it("counts the territories of every detail, a detail deeper having more", () => {
    const paths = [
      "apps/web/index.ts",
      ...filesIn("apps/web/src", 3),
      ...filesIn("packages/lib", 3),
      ...filesIn("packages/cli", 3),
    ];
    const details = detailsOf(
      [touching("2026-02-20T00:00:00Z", paths, ada)],
      paths,
      ["apps/web", "packages/lib", "packages/cli"],
    );

    expect(
      details.map(({ detail, totalTerritories, territories }) => [
        detail,
        totalTerritories,
        territories.length,
      ]),
    ).toStrictEqual([
      [1, 3, 3],
      [2, 4, 4],
    ]);
  });
});

describe("territoryDetails other-files territories", () => {
  const old = filesIn("apps/old", 3);
  const otherFilesOf = (scripts: ReadonlyArray<string>) => {
    const [detail] = detailsOf(
      [
        touching("2026-02-21T00:00:00Z", web, ada),
        touching("2025-01-01T00:00:00Z", old, grace),
        touching("2025-01-02T00:00:00Z", scripts, grace),
      ],
      [...web, ...old, ...scripts],
      ["apps/web", "apps/old"],
    );
    return detail.territories.find(({ kind }) => kind === "other");
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

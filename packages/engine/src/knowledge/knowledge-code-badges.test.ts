import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import { at, classifiedCommit } from "../testing/classified-commit.js";
import { inventoryFile, universeStatsOf } from "../testing/inventory-file.js";
import { knowledge } from "./knowledge.js";

const now = DateTime.makeUnsafe("2026-03-01T00:00:00Z");
const ada = { name: "Ada", email: "ada@example.com" };

const filesIn = (directory: string, count = 3): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `${directory}/f${index}.ts`);

/** `times` commits that each change every file of `directory`. */
const revising = (directory: string, count: number, times: number) =>
  Array.from({ length: times }, (_, index) =>
    classifiedCommit({
      time: at(`2026-02-${String(index + 1).padStart(2, "0")}T00:00:00Z`),
      author: ada,
      changes: filesIn(directory, count).map((path) => ({
        path,
        added: 1,
        deleted: 0,
      })),
    }),
  );

const badgesOf = (
  packages: Readonly<Record<string, { files: number; revisions: number }>>,
) => {
  const commits = Object.entries(packages).flatMap(
    ([root, { files, revisions }]) => revising(root, files, revisions),
  );
  const universe = Object.entries(packages).flatMap(([root, { files }]) =>
    filesIn(root, files).map((path) => inventoryFile(path)),
  );
  const { section } = knowledge({
    commits,
    universe,
    stats: universeStatsOf(universe, commits),
    scope: ".",
    packageRoots: Object.keys(packages),
    shallow: false,
    headTime: at("2026-02-25T00:00:00Z"),
    now,
  });
  return Object.fromEntries(
    section.territories.territories.map(({ path, badges }) => [
      path,
      badges.map(({ kind }) => kind).filter((kind) => kind === "churning"),
    ]),
  );
};

describe("knowledge churning among siblings", () => {
  it("awards it to the package revised far more often than its siblings and the repository", () => {
    expect(
      badgesOf({
        "packages/a": { files: 3, revisions: 8 },
        "packages/b": { files: 3, revisions: 1 },
        "packages/c": { files: 3, revisions: 1 },
        "packages/d": { files: 3, revisions: 1 },
      }),
    ).toStrictEqual({
      "packages/a": ["churning"],
      "packages/b": [],
      "packages/c": [],
      "packages/d": [],
    });
  });

  it("does not award it to packages that are revised as often as their siblings, though more than the repository", () => {
    // three packages revised 8 times each, a fourth with many rarely changed files lowers the repository's median to 1
    expect(
      badgesOf({
        "packages/a": { files: 3, revisions: 8 },
        "packages/b": { files: 3, revisions: 8 },
        "packages/c": { files: 3, revisions: 8 },
        "packages/d": { files: 30, revisions: 1 },
      }),
    ).toStrictEqual({
      "packages/a": [],
      "packages/b": [],
      "packages/c": [],
      "packages/d": [],
    });
  });
});

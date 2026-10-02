import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import type { ClassifiedCommit } from "../automation/classify.js";
import { at, classifiedCommit } from "../testing/classified-commit.js";
import { knowledge } from "./knowledge.js";

const now = DateTime.makeUnsafe("2026-03-01T00:00:00Z");
const ada = { name: "Ada", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };

const filesIn = (directory: string): ReadonlyArray<string> =>
  Array.from({ length: 3 }, (_, index) => `${directory}/f${index}.ts`);

const paths = [...filesIn("packages/api"), ...filesIn("packages/web")];

const touching = (
  time: string,
  directory: string,
  author: ClassifiedCommit["author"],
): ClassifiedCommit =>
  classifiedCommit({
    time: at(time),
    author,
    changes: filesIn(directory).map((path) => ({
      path,
      added: 10,
      deleted: 0,
    })),
  });

const run = (commits: ReadonlyArray<ClassifiedCommit>, since: string) =>
  knowledge({
    commits,
    universe: paths.map((path) => ({ path, loc: 50 })),
    scope: ".",
    packageRoots: ["packages/api", "packages/web"],
    window: { since, until: "2026-03-01T00:00:00.000Z" },
    headTime: at("2026-02-25T00:00:00Z"),
    now,
  });

const kindsOf = (result: ReturnType<typeof run>, depth: number, path: string) =>
  result.section.areas?.levels
    .find((level) => level.depth === depth)
    ?.areas.find((area) => area.path === path)
    ?.badges.map(({ kind }) => kind);

// api: Ada since 2025; web: Grace, created in February
const history = [
  touching("2026-02-20T00:00:00Z", "packages/web", grace),
  touching("2026-02-10T00:00:00Z", "packages/api", ada),
  touching("2025-01-10T00:00:00Z", "packages/api", ada),
];

describe("knowledge area badges", () => {
  const result = run(history, "2026-02-01T00:00:00.000Z");

  it("awards the badges the area's knowledge and history earn", () => {
    expect(kindsOf(result, 1, "packages/web")).toStrictEqual(["island", "new"]);
    expect(kindsOf(result, 1, "packages/api")).toStrictEqual(["island"]);
  });

  it("awards in focus to the one area with the most commits in the window", () => {
    // each area has one commit in the window: no area is in focus
    expect(kindsOf(result, 1, "packages/web")).not.toContain("in-focus");

    const focused = run(
      [touching("2026-02-21T00:00:00Z", "packages/web", grace), ...history],
      "2026-02-01T00:00:00.000Z",
    );

    expect(kindsOf(focused, 1, "packages/web")).toContain("in-focus");
    expect(kindsOf(focused, 1, "packages/api")).not.toContain("in-focus");
  });

  it("describes the recommended level's areas for the other sections", () => {
    const { recommendedAreas } = result;

    expect(
      recommendedAreas.map(({ path, orphaned, withoutActiveExpert }) => [
        path,
        orphaned,
        withoutActiveExpert,
      ]),
    ).toStrictEqual([
      ["packages/api", false, 0],
      ["packages/web", false, 0],
    ]);
    expect(
      recommendedAreas.map(({ activeExperts }) => activeExperts),
    ).toStrictEqual([[ada.email], [grace.email]]);
  });
});

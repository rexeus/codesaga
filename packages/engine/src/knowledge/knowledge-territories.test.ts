import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import type { ClassifiedCommit } from "../automation/classify.js";
import { at, classifiedCommit } from "../testing/classified-commit.js";
import { knowledge } from "./knowledge.js";

const now = DateTime.makeUnsafe("2026-03-01T00:00:00Z");
const ada = { name: "Ada", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };
const linus = { name: "Linus", email: "linus@example.com" };

const filesIn = (directory: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `${directory}/f${index}.ts`);

// 16 files in 4 packages: detail 1 has 4 viable territories; at detail 2 packages/lib splits into a and b, which have different experts, so there are 5.
const paths = [
  "apps/web/index.ts",
  ...filesIn("apps/web/src", 3),
  ...filesIn("packages/lib/a", 3),
  ...filesIn("packages/lib/b", 3),
  ...filesIn("packages/cli", 3),
  ...filesIn("packages/api", 3),
];
const packageRoots = [
  "apps/web",
  "packages/api",
  "packages/cli",
  "packages/lib",
];

/** Ada writes apps/web and packages/lib/a, Grace packages/lib/b and packages/cli, Linus packages/api. */
const WRITTEN_BY: ReadonlyMap<string, ReadonlyArray<string>> = new Map([
  [ada.email, ["apps/web", "packages/lib/a"]],
  [grace.email, ["packages/lib/b", "packages/cli"]],
  [linus.email, ["packages/api"]],
]);

const filesOf = (author: ClassifiedCommit["author"]): ReadonlyArray<string> =>
  paths.filter((path) =>
    (WRITTEN_BY.get(author.email) ?? []).some((prefix) =>
      path.startsWith(prefix),
    ),
  );

const commit = (
  time: string,
  author: ClassifiedCommit["author"],
): ClassifiedCommit =>
  classifiedCommit({
    time: at(time),
    author,
    changes: filesOf(author).map((path) => ({ path, added: 10, deleted: 0 })),
  });

const territoriesOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
  detail?: number,
) =>
  knowledge({
    commits,
    universe: paths.map((path) => ({ path, loc: 50 })),
    scope: ".",
    packageRoots,
    detail,
    shallow: false,
    headTime: at("2026-02-01T00:00:00Z"),
    now,
  }).section.territories;

const threeActive = [
  commit("2026-02-20T00:00:00Z", ada),
  commit("2026-02-19T00:00:00Z", grace),
  commit("2026-02-18T00:00:00Z", linus),
];

describe("knowledge territories", () => {
  it("recommends the deepest detail with at most two territories per contributor active in 90 days", () => {
    // 3 active contributors allow 6; detail 1 has 4 viable territories, detail 2 has 5
    const territories = territoriesOf(threeActive);

    expect(territories).toMatchObject({
      detail: 2,
      recommendedDetail: 2,
      reason:
        "detail 2: 5 territories (without other files) for 3 active contributors",
    });
    expect(territories.maxDetail).toBe(2);
  });

  it("does not count contributors whose last commit is older than 90 days", () => {
    // 1 active contributor allows 4 territories, which detail 2 (5) exceeds
    const territories = territoriesOf([
      commit("2026-02-20T00:00:00Z", ada),
      commit("2025-06-01T00:00:00Z", grace),
      commit("2025-06-02T00:00:00Z", linus),
    ]);

    expect(territories).toMatchObject({
      recommendedDetail: 1,
      reason:
        "detail 1: 4 territories (without other files) for 1 active contributor",
    });
  });

  it("sizes the allowance by every contributor when nobody is active", () => {
    const territories = territoriesOf([
      commit("2025-06-03T00:00:00Z", ada),
      commit("2025-06-02T00:00:00Z", grace),
      commit("2025-06-01T00:00:00Z", linus),
    ]);

    expect(territories.reason).toBe(
      "detail 2: 5 territories (without other files) for 3 contributors",
    );
  });

  it("starts at the requested detail and still reports the recommendation", () => {
    expect(territoriesOf(threeActive, 1)).toMatchObject({
      detail: 1,
      recommendedDetail: 2,
    });
  });

  it("starts at the deepest detail when the requested detail is beyond it", () => {
    expect(territoriesOf(threeActive, 9)).toMatchObject({
      detail: 2,
      recommendedDetail: 2,
    });
  });

  it.each([0, 0.5, -3, Number.NaN, Number.POSITIVE_INFINITY])(
    "starts at the recommended detail for the requested detail %s",
    (detail) => {
      expect(territoriesOf(threeActive, detail).detail).toBe(2);
    },
  );

  it("rounds a fractional detail down", () => {
    expect(territoriesOf(threeActive, 1.9).detail).toBe(1);
  });
});

const kindsIn = (
  territories: ReadonlyArray<{
    readonly path: string;
    readonly badges: ReadonlyArray<{ readonly kind: string }>;
  }>,
  path: string,
) =>
  territories
    .find((territory) => territory.path === path)
    ?.badges.map(({ kind }) => kind);

describe("knowledge territory tree badges", () => {
  it("awards in focus to the busiest territory among its siblings, at every level of the tree", () => {
    // packages/lib touches 3 commits, packages/cli 2, apps/web and packages/api 1; inside lib, b has 2 commits and a has 1
    const { territories } = territoriesOf([
      commit("2026-02-20T00:00:00Z", ada),
      commit("2026-02-19T00:00:00Z", grace),
      commit("2026-02-18T00:00:00Z", grace),
      commit("2026-02-17T00:00:00Z", linus),
    ]);
    const lib = territories.find(({ path }) => path === "packages/lib");

    expect(kindsIn(territories, "packages/lib")).toContain("in-focus");
    expect(kindsIn(territories, "packages/cli")).not.toContain("in-focus");
    expect(kindsIn(lib?.territories ?? [], "packages/lib/b")).toContain(
      "in-focus",
    );
    expect(kindsIn(lib?.territories ?? [], "packages/lib/a")).not.toContain(
      "in-focus",
    );
  });
});

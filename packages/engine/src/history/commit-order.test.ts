import { assert, describe, it } from "@effect/vitest";

import { inTopologicalOrder } from "./commit-order.js";
import type { Commit } from "./parse-log.js";

const commit = (
  sha: string,
  parents: ReadonlyArray<string>,
  committerTime: number,
): Commit => ({
  sha,
  parents,
  time: 0,
  committerTime,
  offsetMinutes: 0,
  author: { name: "Ada", email: "ada@example.com" },
  committer: { name: "Ada", email: "ada@example.com" },
  trailers: [],
  markers: [],
  changes: [],
});

const shas = (commits: ReadonlyArray<Commit>) => commits.map(({ sha }) => sha);

const permutations = <T>(items: ReadonlyArray<T>): ReadonlyArray<Array<T>> =>
  items.length <= 1
    ? [[...items]]
    : items.flatMap((item, index) =>
        permutations(items.filter((_, other) => other !== index)).map((rest) =>
          [item].concat(rest),
        ),
      );

describe("inTopologicalOrder", () => {
  it("puts a child before its parent in one second, whatever their shas", () => {
    const chain = [
      commit("a", [], 100),
      commit("b", ["a"], 100),
      commit("c", ["b"], 100),
      commit("d", ["c"], 100),
    ];

    assert.deepStrictEqual(shas(inTopologicalOrder(chain)), [
      "d",
      "c",
      "b",
      "a",
    ]);
  });

  it("puts a child before its parent when the child's clock is behind", () => {
    const skewed = [commit("parent", [], 200), commit("child", ["parent"], 50)];

    assert.deepStrictEqual(shas(inTopologicalOrder(skewed)), [
      "child",
      "parent",
    ]);
  });
});

describe("inTopologicalOrder across branches", () => {
  it("follows the newest ready commit across merged branches, equal times by ascending sha", () => {
    const history = [
      commit("root", [], 1),
      commit("x1", ["root"], 2),
      commit("y1", ["root"], 3),
      commit("y2", ["y1"], 4),
      commit("x2", ["x1"], 5),
      commit("merge", ["x2", "y2"], 6),
      commit("later-b", ["merge"], 7),
      commit("later-a", ["merge"], 7),
    ];

    assert.deepStrictEqual(shas(inTopologicalOrder(history)), [
      "later-a",
      "later-b",
      "merge",
      "x2",
      "y2",
      "y1",
      "x1",
      "root",
    ]);
  });

  it("returns one order for every arrangement of the same commits", () => {
    const history = [
      commit("root", [], 1),
      commit("x", ["root"], 2),
      commit("y", ["root"], 2),
      commit("merge", ["x", "y"], 1),
      commit("tip", ["merge"], NaN),
    ];

    const orders = new Set(
      permutations(history).map((arrangement) =>
        shas(inTopologicalOrder(arrangement)).join(" "),
      ),
    );

    assert.deepStrictEqual([...orders], ["tip merge x y root"]);
  });

  it("ignores parents outside the set and emits an unreadable time last among the ready", () => {
    const partial = [
      commit("undated", ["cut-off"], NaN),
      commit("dated", ["cut-off"], 1),
    ];

    assert.deepStrictEqual(shas(inTopologicalOrder(partial)), [
      "dated",
      "undated",
    ]);
  });
});

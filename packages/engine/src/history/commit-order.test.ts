import { assert, describe, it } from "@effect/vitest";

import { inCanonicalOrder } from "./commit-order.js";
import type { Commit } from "./parse-log.js";

const commit = (sha: string, committerTime: number): Commit => ({
  sha,
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

describe("inCanonicalOrder", () => {
  it("puts the newest committer time first and breaks ties by ascending sha", () => {
    const commits = [
      commit("c", 100),
      commit("b", 300),
      commit("z", 200),
      commit("a", 200),
    ];

    assert.deepStrictEqual(shas(inCanonicalOrder(commits)), [
      "b",
      "a",
      "z",
      "c",
    ]);
  });

  it("returns one order for any arrangement of the same commits, an unreadable time last", () => {
    const [a, b, c, d] = [
      commit("a", 5),
      commit("b", 5),
      commit("c", NaN),
      commit("d", NaN),
    ];

    for (const arrangement of [
      [d, b, a, c],
      [c, d, b, a],
      [a, b, c, d],
    ]) {
      assert.deepStrictEqual(shas(inCanonicalOrder(arrangement)), [
        "a",
        "b",
        "c",
        "d",
      ]);
    }
  });
});

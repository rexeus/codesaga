import { describe, expect, it } from "vitest";

import type { FirstParentCommit } from "../first-parent.js";
import { combineChains } from "./combine.js";

const commit = (
  sha: string,
  time: number,
  paths: ReadonlyArray<string> = [],
): FirstParentCommit => ({
  sha,
  time,
  changes: paths.map((path) => ({ path, oid: `${sha}-${path}` })),
});

const shas = (commits: ReadonlyArray<FirstParentCommit>) =>
  commits.map(({ sha }) => sha);

describe("combineChains", () => {
  it("returns the chain of the head as it is when nothing was absorbed", () => {
    const head = [commit("a", 1, ["a.ts"]), commit("b", 2)];

    expect(combineChains(head, [])).toStrictEqual(head);
  });

  it("interleaves the chains by time, each in its own order, and lets the merge follow the history it absorbs", () => {
    const head = [commit("r", 10), commit("m", 11), commit("h", 30)];
    const absorbed = {
      mergedAt: "m",
      prefix: "",
      commits: [commit("x1", 5), commit("x2", 20), commit("x3", 12)],
    };

    const combined = combineChains(head, [absorbed]);

    expect(shas(combined)).toStrictEqual(["x1", "r", "x2", "x3", "m", "h"]);
    expect(
      combined.map(({ line, absorbs }) => [line ?? 0, absorbs ?? []]),
    ).toStrictEqual([
      [1, []],
      [0, []],
      [1, []],
      [1, []],
      [0, [1]],
      [0, []],
    ]);
  });
});

describe("combineChains over dates and paths", () => {
  it("dates a commit without a readable date like the one before it in its chain", () => {
    const head = [commit("r", 10), commit("m", 11)];
    const absorbed = {
      mergedAt: "m",
      prefix: "",
      commits: [commit("x1", 5), commit("x2", NaN), commit("x3", 20)],
    };

    expect(shas(combineChains(head, [absorbed]))).toStrictEqual([
      "x1",
      "x2",
      "r",
      "x3",
      "m",
    ]);
  });

  it("names the paths of an absorbed history under the directory its merge put it in, also through a history that absorbed it", () => {
    const head = [commit("r", 10), commit("m", 50)];
    const outer = {
      mergedAt: "m",
      prefix: "packages/",
      commits: [commit("p1", 20, ["p.ts"]), commit("pm", 40)],
    };
    const inner = {
      mergedAt: "pm",
      prefix: "inner/",
      commits: [commit("q1", 5, ["q.ts"])],
    };

    const combined = combineChains(head, [outer, inner]);

    expect(
      combined.flatMap(({ changes }) => changes.map(({ path }) => path)),
    ).toStrictEqual(["packages/inner/q.ts", "packages/p.ts"]);
  });

  it("leaves out a history whose merge is on no chain, so that no history never ends", () => {
    const head = [commit("r", 10)];
    const stray = {
      mergedAt: "nowhere",
      prefix: "",
      commits: [commit("x", 5)],
    };

    expect(shas(combineChains(head, [stray]))).toStrictEqual(["r"]);
  });
});

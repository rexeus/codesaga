import { describe, expect, it } from "vitest";

import { stronglyConnected } from "./scc.js";

/** Components as sorted lists in sorted order, since the algorithm promises no order. */
const componentsOf = (
  successors: ReadonlyArray<ReadonlyArray<number>>,
): ReadonlyArray<ReadonlyArray<number>> =>
  stronglyConnected(successors)
    .map((component) => component.toSorted((left, right) => left - right))
    .toSorted((left, right) => (left[0] ?? 0) - (right[0] ?? 0));

describe("stronglyConnected", () => {
  it("puts every node of an acyclic graph in a component of its own", () => {
    expect(componentsOf([[1, 2], [2], []])).toStrictEqual([[0], [1], [2]]);
  });

  it("joins the nodes of a cycle and leaves the nodes that only lead into it", () => {
    // 0 -> 1 -> 2 -> 0, and 3 -> 0, 2 -> 4
    expect(componentsOf([[1], [2], [0, 4], [0], []])).toStrictEqual([
      [0, 1, 2],
      [3],
      [4],
    ]);
  });

  it("separates two cycles joined by a one-way edge", () => {
    // 0 <-> 1, 2 <-> 3, 1 -> 2
    expect(componentsOf([[1], [0, 2], [3], [2]])).toStrictEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it("keeps a node that imports itself in a component of its own", () => {
    expect(componentsOf([[0]])).toStrictEqual([[0]]);
  });

  it("handles a chain far deeper than the call stack", () => {
    const length = 200_000;
    const chain = Array.from({ length }, (_, node) =>
      node + 1 < length ? [node + 1] : [0],
    );

    const components = stronglyConnected(chain);

    expect(components).toHaveLength(1);
    expect(components[0]).toHaveLength(length);
  });
});

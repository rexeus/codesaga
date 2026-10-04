import { describe, expect, it } from "vitest";

import { absorptionsOf } from "./find-absorbed.js";
import type { ParentGraph } from "./find-absorbed.js";

/** A graph from `commit: parents` lines, so a test reads as the history it draws. */
const graphOf = (parents: Readonly<Record<string, string>>): ParentGraph =>
  new Map(
    Object.entries(parents).map(([commit, list]) => [
      commit,
      list.split(" ").filter((parent) => parent !== ""),
    ]),
  );

describe("absorptionsOf", () => {
  it("finds nothing in a linear history", () => {
    expect(
      absorptionsOf(graphOf({ a: "", b: "a", c: "b" }), "c"),
    ).toStrictEqual([]);
  });

  it("leaves a branch that forks from the lineage to the chain of the head", () => {
    const graph = graphOf({ a: "", b: "a", f: "b", c: "b", m: "c f" });

    expect(absorptionsOf(graph, "m")).toStrictEqual([]);
  });
});

describe("absorptionsOf over histories merged in", () => {
  it("finds a history that shares no commit with the lineage, at the merge that took it in", () => {
    const graph = graphOf({ a: "", b: "a", x: "", y: "x", m: "b y" });

    expect(absorptionsOf(graph, "m")).toStrictEqual([
      { tip: "y", mergedAt: "m" },
    ]);
  });

  it("finds every history of an octopus merge and of later merges, oldest merge first", () => {
    const graph = graphOf({
      a: "",
      x: "",
      y: "",
      z: "",
      m1: "a x y",
      b: "m1",
      m2: "b z",
    });

    expect(absorptionsOf(graph, "m2")).toStrictEqual([
      { tip: "x", mergedAt: "m1" },
      { tip: "y", mergedAt: "m1" },
      { tip: "z", mergedAt: "m2" },
    ]);
  });
});

describe("absorptionsOf over histories of histories", () => {
  it("finds a history that an absorbed history absorbed", () => {
    const graph = graphOf({
      a: "",
      x: "",
      y: "x",
      q: "",
      xm: "y q",
      m: "a xm",
    });

    expect(absorptionsOf(graph, "m")).toStrictEqual([
      { tip: "xm", mergedAt: "m" },
      { tip: "q", mergedAt: "xm" },
    ]);
  });

  it("leaves a history merged into a branch to that branch's merge, which is an ordinary merge", () => {
    const graph = graphOf({
      a: "",
      f: "a",
      x: "",
      fm: "f x",
      c: "a",
      m: "c fm",
    });

    expect(absorptionsOf(graph, "m")).toStrictEqual([]);
  });

  it("does not take a history twice when two merges bring it", () => {
    const graph = graphOf({
      a: "",
      x: "",
      m1: "a x",
      b: "m1",
      m2: "b x",
    });

    expect(absorptionsOf(graph, "m2")).toStrictEqual([
      { tip: "x", mergedAt: "m1" },
    ]);
  });
});

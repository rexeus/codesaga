import { describe, expect, it } from "vitest";

import { graphOf } from "../../testing/import-graph.js";
import { assignmentOf } from "./territory-assignment.js";
import type { VisibleTerritory } from "./territory-assignment.js";
import { territoryMapOf } from "./territory-map.js";

const folder = (
  path: string,
  files: ReadonlyArray<string>,
): VisibleTerritory => ({
  path,
  kind: "folder",
  paths: files.map((file) => `${path}/${file}`),
});

const territories = [
  folder("core", ["k1.ts", "k2.ts", "k3.ts", "k.test.ts"]),
  folder("app", ["p1.ts", "p2.ts"]),
  folder("util", ["u1.ts", "u2.ts"]),
  folder("tool", ["t1.ts"]),
];

const ref = (path: string) => ({ path, kind: "folder" });

const graph = graphOf([
  ["app/p1.ts", "core/k1.ts"],
  ["app/p2.ts", "core/k1.ts"],
  ["app/p2.ts", "core/k2.ts"],
  ["tool/t1.ts", "core/k1.ts"],
  ["tool/t1.ts", "core/k3.ts"],
  ["core/k1.ts", "util/u1.ts"],
  ["core/k2.ts", "util/u1.ts"],
  ["core/k3.ts", "util/u2.ts"],
  ["util/u1.ts", "app/p1.ts", "type"],
  ["app/p1.ts", "util/u2.ts"],
  // a test importing production code is no edge of the map
  ["core/k.test.ts", "app/p1.ts"],
]);

const map = territoryMapOf(graph, assignmentOf(graph, territories), 2);

describe("territoryMapOf coupling", () => {
  it("counts afferent and efferent edges per territory, and instability as ce over ca plus ce", () => {
    expect(map.territories).toStrictEqual([
      { ...ref("core"), files: 3, ca: 5, ce: 3, instability: 0.375 },
      { ...ref("app"), files: 2, ca: 1, ce: 4, instability: 0.8 },
      { ...ref("util"), files: 2, ca: 4, ce: 1, instability: 0.2 },
      { ...ref("tool"), files: 1, ca: 0, ce: 2, instability: 1 },
    ]);
    expect(map.totalTerritories).toBe(4);
    expect(map.detail).toBe(2);
  });

  it("lists the edges between territories with their file counts, the most files first", () => {
    expect(map.edges).toStrictEqual([
      { from: ref("app"), to: ref("core"), files: 3, typeOnlyFiles: 0 },
      { from: ref("core"), to: ref("util"), files: 3, typeOnlyFiles: 0 },
      { from: ref("tool"), to: ref("core"), files: 2, typeOnlyFiles: 0 },
      { from: ref("app"), to: ref("util"), files: 1, typeOnlyFiles: 0 },
      { from: ref("util"), to: ref("app"), files: 1, typeOnlyFiles: 1 },
    ]);
    expect(map.totalEdges).toBe(5);
  });

  it("reports an edge toward a territory 0.3 less stable between territories with 5 edges each, and no other", () => {
    expect(map.towardLessStable).toStrictEqual([
      {
        from: ref("util"),
        to: ref("app"),
        files: 1,
        fromInstability: 0.2,
        toInstability: 0.8,
      },
    ]);
  });

  it("finds a cycle between territories only with the type-only edge counted", () => {
    expect(map.cycles).toStrictEqual([]);
    expect(map.cyclesWithTypes).toBe(1);
  });
});

describe("territoryMapOf cycles", () => {
  it("lists the territories of a cycle by value edges in path order, and leaves out those that only lead into it", () => {
    const cyclic = graphOf([
      ["app/p1.ts", "core/k1.ts"],
      ["core/k1.ts", "util/u1.ts"],
      ["util/u1.ts", "app/p1.ts"],
      ["tool/t1.ts", "core/k1.ts"],
    ]);

    const { cycles, cyclesWithTypes } = territoryMapOf(
      cyclic,
      assignmentOf(cyclic, territories),
      1,
    );

    expect(cycles).toStrictEqual([
      { territories: [ref("app"), ref("core"), ref("util")] },
    ]);
    expect(cyclesWithTypes).toBe(1);
  });

  it("gives no instability to a territory without edges and omits territories that hold no production file", () => {
    const sparse = graphOf([["app/p1.ts", "app/p2.ts"]], ["core/k.test.ts"]);

    const { territories: listed } = territoryMapOf(
      sparse,
      assignmentOf(sparse, territories),
      1,
    );

    expect(listed).toStrictEqual([{ ...ref("app"), files: 2, ca: 0, ce: 0 }]);
  });

  it("takes other files as nodes but never judges them", () => {
    const withOther: ReadonlyArray<VisibleTerritory> = [
      { path: "x", kind: "other", paths: ["x/o1.ts", "x/o2.ts"] },
      { path: "app", kind: "folder", paths: ["app/p1.ts", "app/p2.ts"] },
    ];
    const edges = graphOf([
      ["x/o1.ts", "app/p1.ts"],
      ["x/o2.ts", "app/p1.ts"],
      ["x/o1.ts", "app/p2.ts"],
      ["x/o2.ts", "app/p2.ts"],
      ["app/p1.ts", "x/o1.ts"],
    ]);

    const result = territoryMapOf(edges, assignmentOf(edges, withOther), 1);

    expect(result.edges).toHaveLength(2);
    expect(result.towardLessStable).toStrictEqual([]);
    expect(result.cycles).toStrictEqual([]);
  });
});

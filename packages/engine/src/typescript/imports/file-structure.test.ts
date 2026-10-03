import { describe, expect, it } from "vitest";

import { graphOf } from "../../testing/import-graph.js";
import { cyclesOf } from "./file-cycles.js";
import { fileStructureOf } from "./file-structure.js";

/** The territories are the directories. */
const directoriesSpanned = (paths: ReadonlyArray<string>): number =>
  new Set(paths.map((path) => path.slice(0, path.lastIndexOf("/")))).size;

const graph = {
  ...graphOf([
    // a cycle of three files over two directories
    ["x/a.ts", "x/b.ts"],
    ["x/b.ts", "y/c.ts"],
    ["y/c.ts", "x/a.ts"],
    // a cycle only through `import type`
    ["y/t1.ts", "y/t2.ts", "type"],
    ["y/t2.ts", "y/t1.ts", "type"],
    // a file that imports itself
    ["z/self.ts", "z/self.ts"],
    // a test that imports a member of the cycle
    ["x/a.test.ts", "x/a.ts"],
  ]),
  requests: {
    resolved: 18,
    external: 4,
    assets: 1,
    dynamicUnresolvable: 3,
    unresolved: new Map([
      ["./generated", 2],
      ["@acme/missing", 5],
    ]),
  },
};

const structure = fileStructureOf(graph, cyclesOf(graph), directoriesSpanned);

describe("fileStructureOf cycles", () => {
  it("lists each cycle by value edges with its files and the territories it spans", () => {
    expect(structure.cycles.top).toStrictEqual([
      { size: 3, files: ["x/a.ts", "x/b.ts", "y/c.ts"], territories: 2 },
      { size: 1, files: ["z/self.ts"], territories: 1 },
    ]);
    expect(structure.cycles.count).toBe(2);
    expect(structure.cycles.largest).toBe(3);
  });

  it("gives the figures with type-only edges beside them and counts the cycles that exist only through them", () => {
    expect(structure.cycles.withTypes).toStrictEqual({ count: 3, largest: 3 });
    expect(structure.cycles.typeOnly).toBe(1);
  });

  it("lets a test that imports a cycle member neither join the cycle nor count as an importer", () => {
    expect(structure.cycles.top[0]?.files).not.toContain("x/a.test.ts");
    expect(
      structure.fanIn.top.find(({ path }) => path === "x/a.ts")?.count,
    ).toBe(1);
  });
});

describe("fileStructureOf figures", () => {
  it("counts production edges by kind and the edges that touch a test apart", () => {
    expect(structure.edges).toStrictEqual({ value: 4, typeOnly: 2, tests: 1 });
    expect(structure.files).toBe(6);
    expect(structure.testFiles).toBe(1);
  });

  it("takes fan-in and fan-out over production files, leaving out self-imports, ordered by count and then path", () => {
    expect(structure.fanIn).toStrictEqual({
      median: 1,
      top: [
        { path: "x/a.ts", count: 1 },
        { path: "x/b.ts", count: 1 },
        { path: "y/c.ts", count: 1 },
        { path: "y/t1.ts", count: 1 },
        { path: "y/t2.ts", count: 1 },
      ],
    });
    expect(structure.fanOut.top).toHaveLength(5);
  });

  it("reports the unresolved specifiers with their share of the specifiers into the repository", () => {
    expect(structure.unresolved).toStrictEqual({
      count: 7,
      share: 0.28,
      top: [
        { specifier: "@acme/missing", files: 5 },
        { specifier: "./generated", files: 2 },
      ],
    });
    expect(structure.external).toBe(4);
    expect(structure.assets).toBe(1);
    expect(structure.dynamicUnresolvable).toBe(3);
  });
});

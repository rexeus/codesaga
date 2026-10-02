import { describe, expect, it } from "vitest";

import { graphOf } from "../../testing/import-graph.js";
import { cyclesOf } from "./file-cycles.js";
import { assignmentOf } from "./territory-assignment.js";
import type { VisibleTerritory } from "./territory-assignment.js";
import { territoryImportsOf } from "./territory-neighbours.js";

const folder = (
  path: string,
  files: ReadonlyArray<string>,
): VisibleTerritory => ({
  path,
  kind: "folder",
  paths: files,
});

const ref = (path: string) => ({ path, kind: "folder" });

const visible = [
  folder("app", ["app/a.ts", "app/sub/b.ts", "app/readme.md"]),
  folder("core", ["core/c.ts", "core/d.ts"]),
  folder("util", ["util/u.ts"]),
];

const graph = graphOf([
  ["app/a.ts", "core/c.ts"],
  ["core/c.ts", "app/a.ts"],
  ["app/sub/b.ts", "util/u.ts"],
  ["util/u.ts", "util/u.ts"],
  ["app/a.ts", "app/sub/b.ts"],
]);

const forPaths = territoryImportsOf(
  graph,
  assignmentOf(graph, visible),
  cyclesOf(graph),
);

describe("territoryImportsOf", () => {
  it("names the territories a map territory imports and the ones that import it, and sees a cycle that leaves it", () => {
    expect(
      forPaths(["app/a.ts", "app/sub/b.ts", "app/readme.md"]),
    ).toStrictEqual({
      imports: [ref("core"), ref("util")],
      importedBy: [ref("core")],
      inCycle: true,
    });
    expect(forPaths(["core/c.ts", "core/d.ts"])).toStrictEqual({
      imports: [ref("app")],
      importedBy: [ref("app")],
      inCycle: true,
    });
  });

  it("does not count a self-import, or edges inside the territory, as a cycle or a neighbour", () => {
    expect(forPaths(["util/u.ts"])).toStrictEqual({
      imports: [],
      importedBy: [ref("app")],
      inCycle: false,
    });
  });

  it("reads a territory below the map's detail against the map's territories it shares no file with", () => {
    expect(forPaths(["app/sub/b.ts"])).toStrictEqual({
      imports: [ref("util")],
      importedBy: [],
      inCycle: false,
    });
    expect(forPaths(["app/a.ts"])).toStrictEqual({
      imports: [ref("core")],
      importedBy: [ref("core")],
      inCycle: true,
    });
  });

  it("is not in a cycle when every file of the cycle lies inside it", () => {
    expect(forPaths(["app/a.ts", "core/c.ts"])).toStrictEqual({
      imports: [],
      importedBy: [],
      inCycle: false,
    });
  });

  it("says nothing of a territory without a file of the graph", () => {
    expect(forPaths(["docs/guide.md"])).toBeUndefined();
  });
});

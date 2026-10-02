import { describe, expect, it } from "vitest";

import { firstOf, sampleBlock } from "../testing/reports.js";
import { couplingRows, edgeRows, mapNotes } from "./typescript-imports.js";

const imports = sampleBlock("imports");
const map = imports.territories;

describe("territory names", () => {
  it("names the root folder and the small files grouped under a territory", () => {
    const edge = firstOf(map.edges);
    const named = (path: string, kind: "folder" | "other") =>
      edgeRows({
        ...imports,
        territories: {
          ...map,
          edges: [{ ...edge, from: { path, kind } }],
        },
      })[0]?.from;

    expect(named(".", "folder")).toEqual({ name: "/ (root)", kind: "folder" });
    expect(named(".", "other")?.name).toBe("Other files");
    expect(named("packages/engine", "other")?.name).toBe(
      "Other files in packages/engine",
    );
  });
});

describe("edgeRows", () => {
  it("keeps the engine's order and sizes each edge against the largest", () => {
    const rows = edgeRows(imports);

    expect(rows[0]).toEqual({
      from: { name: "apps/web", kind: "package" },
      to: { name: "packages/ui", kind: "package" },
      files: "64",
      fraction: 1,
      typeOnlyFraction: 6 / 64,
      typeOnly: "6 types only",
    });
    // 31 of 64
    expect(rows[1]?.fraction).toBeCloseTo(31 / 64, 6);
  });

  it("says nothing of types for an edge without a type-only pair", () => {
    const edge = { ...firstOf(map.edges), files: 4, typeOnlyFiles: 0 };

    expect(
      edgeRows({ ...imports, territories: { ...map, edges: [edge] } })[0],
    ).toMatchObject({
      typeOnly: null,
      typeOnlyFraction: 0,
    });
  });

  it("has no rows without an edge", () => {
    expect(
      edgeRows({ ...imports, territories: { ...map, edges: [] } }),
    ).toEqual([]);
  });
});

describe("couplingRows", () => {
  it("lists the afferent and efferent coupling and the instability of each territory", () => {
    const rows = couplingRows(imports);

    expect(rows[0]).toEqual({
      name: "packages/ui",
      kind: "package",
      files: "60",
      ca: "98",
      ce: "2",
      instability: "0.02",
      instabilityFraction: 0.02,
    });
  });

  it("leaves the instability of a territory without an edge open", () => {
    const root = couplingRows(imports).find(({ name }) => name === "/ (root)");

    expect(root).toMatchObject({
      ca: "0",
      ce: "0",
      instability: null,
      instabilityFraction: null,
    });
  });
});

describe("mapNotes", () => {
  it("counts the territories and edges at the detail the map was built at", () => {
    expect(mapNotes(imports)).toMatchObject({
      detail: 1,
      counts: "9 territories, 13 edges",
      truncated: null,
      mutual: [],
      mutualMore: null,
    });
  });

  it("lists the edges toward a less stable territory with both instabilities", () => {
    expect(mapNotes(imports).towardLessStable).toEqual([
      {
        from: { name: "packages/ui", kind: "package" },
        to: { name: "packages/api", kind: "package" },
        files: "2 file pairs",
        fromInstability: "0.02",
        toInstability: "0.42",
      },
    ]);
  });

  it("names the groups of territories that import each other", () => {
    const notes = mapNotes({
      ...imports,
      territories: {
        ...map,
        mutualImports: [
          {
            territories: [
              { path: "packages/api", kind: "package" },
              { path: "packages/db", kind: "package" },
            ],
          },
        ],
        totalMutualImports: 3,
      },
    });

    expect(notes.mutual).toEqual([
      [
        { name: "packages/api", kind: "package" },
        { name: "packages/db", kind: "package" },
      ],
    ]);
    expect(notes.mutualMore).toBe("2 more groups not listed");
  });

  it("says when the report limited the lists", () => {
    const notes = mapNotes({
      ...imports,
      territories: { ...map, totalTerritories: 43, totalEdges: 61 },
    });

    expect(notes.truncated).toBe(
      "The report limits the lists to 9 territories and 13 edges.",
    );
    expect(notes.counts).toBe("43 territories, 61 edges");
  });
});

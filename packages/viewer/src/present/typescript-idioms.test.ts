import { describe, expect, it } from "vitest";

import { sampleBlock } from "../testing/reports.js";
import { idiomRows, idiomsTeaser } from "./typescript-idioms.js";

const idioms = sampleBlock("idioms");

describe("idiomRows", () => {
  it("gives every way of writing its share of the pair", () => {
    const rows = idiomRows(idioms);

    // 58 interfaces against 131 object type aliases
    expect(rows[0]).toEqual({
      title: "Object shapes",
      sides: [
        {
          label: "interface",
          count: 58,
          figure: "58",
          share: "31%",
          entity: "slot-1",
        },
        {
          label: "type alias",
          count: 131,
          figure: "131",
          share: "69%",
          entity: "slot-2",
        },
      ],
    });
  });

  it("compares three ways where the report counts three", () => {
    const bindings = idiomRows(idioms).find(
      ({ title }) => title === "Bindings",
    );

    // 3,120 const, 214 let and 3 var of 3,337
    expect(bindings?.sides.map(({ label, share }) => [label, share])).toEqual([
      ["const", "93%"],
      ["let", "6%"],
      ["var", "<1%"],
    ]);
  });

  it("gives the same entity to the same position in every row", () => {
    const rows = idiomRows(idioms);

    expect(rows.every(({ sides }) => sides[0]?.entity === "slot-1")).toBe(true);
  });
});

describe("idiomRows without occurrences", () => {
  it("leaves out a pair that has no occurrence on either side", () => {
    const rows = idiomRows({
      ...idioms,
      enums: { enums: 0, stringUnions: 0 },
      privacy: { hashPrivate: 0, privateModifiers: 0 },
    });

    expect(rows.map(({ title }) => title)).not.toContain("Enumerations");
    expect(rows.map(({ title }) => title)).not.toContain("Class privacy");
    expect(rows).toHaveLength(8);
  });

  it("has no rows for code without any of them", () => {
    const empty = {
      ...idioms,
      files: 0,
      declarations: { interfaces: 0, objectTypes: 0 },
      enums: { enums: 0, stringUnions: 0 },
      topLevel: { classes: 0, functions: 0, arrowConsts: 0 },
      async: { awaits: 0, thenCalls: 0 },
      privacy: { hashPrivate: 0, privateModifiers: 0 },
      exports: { defaultExports: 0, namedExports: 0 },
      bindings: { consts: 0, lets: 0, vars: 0 },
      iteration: { forOf: 0, forEachCalls: 0 },
      mutation: { mutationCalls: 0, transformCalls: 0, spreads: 0 },
      nullish: { optionalChains: 0, nullishCoalescing: 0 },
    };

    expect(idiomRows(empty)).toEqual([]);
  });
});

describe("idiomsTeaser", () => {
  it("says how many comparisons rest on how many files", () => {
    expect(idiomsTeaser(idioms, idiomRows(idioms))).toBe(
      "10 comparisons in 262 production files",
    );
  });
});

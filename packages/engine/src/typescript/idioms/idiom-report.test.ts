import { describe, expect, it } from "vitest";

import { factsWith } from "../../testing/file-facts.js";
import type { ParsedFile } from "../parsed-file.js";
import type { IdiomFacts } from "./idiom-facts.js";
import { idiomsOf } from "./idiom-report.js";

const file = (path: string, idioms: Partial<IdiomFacts>): ParsedFile => ({
  path,
  lines: 10,
  facts: factsWith({ idioms }),
});

describe("idiomsOf", () => {
  it("adds the counts of the production files into pairs", () => {
    const idioms = idiomsOf([
      file("src/a.ts", { interfaces: 2, objectTypes: 1, awaits: 5, consts: 4 }),
      file("src/b.ts", { interfaces: 1, thenCalls: 3, lets: 1, spreads: 2 }),
    ]);

    expect(idioms).toMatchObject({
      files: 2,
      declarations: { interfaces: 3, objectTypes: 1 },
      async: { awaits: 5, thenCalls: 3 },
      bindings: { consts: 4, lets: 1, vars: 0 },
      mutation: { mutationCalls: 0, transformCalls: 0, spreads: 2 },
    });
  });

  it("leaves tests out, since they are written in another style", () => {
    const idioms = idiomsOf([
      file("src/a.ts", { forOf: 1 }),
      file("src/a.test.ts", { forOf: 10, forEachCalls: 7 }),
    ]);

    expect(idioms.files).toBe(1);
    expect(idioms.iteration).toStrictEqual({ forOf: 1, forEachCalls: 0 });
  });

  it("reports zeros for no production file", () => {
    expect(idiomsOf([file("a.test.ts", { enums: 3 })]).enums).toStrictEqual({
      enums: 0,
      stringUnions: 0,
    });
  });
});

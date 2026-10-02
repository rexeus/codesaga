import { describe, expect, it } from "vitest";

import { factsOfText } from "../../testing/file-facts.js";

const modules = (path: string, text: string) => factsOfText(path, text).modules;

describe("module facts: ESM", () => {
  it("counts imports, exports and import.meta, and lists each distinct request once", () => {
    const facts = modules(
      "a.ts",
      [
        'import a from "a";',
        'import { b } from "b";',
        'import "side-effect";',
        'import { b2 } from "b";',
        'export { c } from "c";',
        'export * from "d";',
        "export const e = import.meta.url;",
        "export default 1;",
      ].join("\n"),
    );

    expect(facts).toMatchObject({ esm: 9, commonjs: 0, imports: 3 });
    expect(facts.requests).toStrictEqual([
      { specifier: "a", kind: "import", isType: false },
      { specifier: "b", kind: "import", isType: false },
      { specifier: "side-effect", kind: "import", isType: false },
      { specifier: "c", kind: "export", isType: false },
      { specifier: "d", kind: "export", isType: false },
    ]);
  });

  it("tells type-only imports from value imports, inline type markers included", () => {
    const facts = modules(
      "a.ts",
      [
        'import type { A } from "types";',
        'import { type B, type C } from "inline";',
        'import { type D, e } from "mixed";',
        'import type * as ns from "ns";',
        'export type { F } from "re-types";',
        'import "bare";',
      ].join("\n"),
    );

    expect(facts).toMatchObject({ imports: 4, typeImports: 3 });
    expect(facts.requests).toStrictEqual([
      { specifier: "types", kind: "import", isType: true },
      { specifier: "inline", kind: "import", isType: true },
      { specifier: "mixed", kind: "import", isType: false },
      { specifier: "ns", kind: "import", isType: true },
      { specifier: "re-types", kind: "export", isType: true },
      { specifier: "bare", kind: "import", isType: false },
    ]);
  });

  it("lists dynamic imports with a literal and not those without", () => {
    const facts = modules(
      "a.ts",
      'const a = await import("lazy");\nconst b = import(name);\ntype T = import("types").X;\n',
    );

    expect(facts.requests).toStrictEqual([
      { specifier: "lazy", kind: "dynamic", isType: false },
      { specifier: "types", kind: "dynamic", isType: true },
    ]);
    expect(facts.esm).toBe(0);
  });
});

describe("module facts: CommonJS", () => {
  it("counts require calls, module.exports and exports.x, and lists the literal requires", () => {
    const facts = modules(
      "a.cjs",
      [
        'const a = require("a");',
        "const b = require(name);",
        "module.exports = { a };",
        "exports.c = 1;",
        "module.exports.d = 2;",
        "const local = {}; local.exports = 3;",
        'const path = require.resolve("p");',
      ].join("\n"),
    );

    expect(facts).toMatchObject({ esm: 0, commonjs: 5 });
    expect(facts.requests).toStrictEqual([
      { specifier: "a", kind: "require", isType: false },
    ]);
  });

  it("counts import = require and export = as CommonJS", () => {
    const facts = modules(
      "a.ts",
      'import fs = require("fs");\nimport type T = require("t");\nexport = fs;\n',
    );

    expect(facts).toMatchObject({ esm: 0, commonjs: 3 });
    expect(facts.requests).toStrictEqual([
      { specifier: "fs", kind: "require", isType: false },
      { specifier: "t", kind: "require", isType: true },
    ]);
  });

  it("counts a file with both systems in both", () => {
    expect(
      modules("a.ts", 'import a from "a";\nconst b = require("b");\n'),
    ).toMatchObject({ esm: 1, commonjs: 1 });
  });
});

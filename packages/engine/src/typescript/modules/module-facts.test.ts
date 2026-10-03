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

describe("module facts: computed and template specifiers", () => {
  it("reads a template literal without expressions as the specifier it spells", () => {
    const facts = modules(
      "a.ts",
      "const a = await import(`./lazy`);\nconst b = require(`b`);\n",
    );

    expect(facts.requests).toStrictEqual([
      { specifier: "./lazy", kind: "dynamic", isType: false },
      { specifier: "b", kind: "require", isType: false },
    ]);
    expect(facts.dynamicUnresolvable).toBe(0);
  });

  it("counts import() and require() calls with a computed argument, each site once", () => {
    const facts = modules(
      "a.ts",
      [
        "const a = await import(name);",
        "const b = await import(`./x/${name}`);",
        'const c = require("./" + name);',
        "const d = require(name);",
        "const e = require();",
        'const f = import("literal");',
      ].join("\n"),
    );

    expect(facts.dynamicUnresolvable).toBe(4);
    expect(facts.requests).toStrictEqual([
      { specifier: "literal", kind: "dynamic", isType: false },
    ]);
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

describe("module facts: shadowed CommonJS names", () => {
  it("keeps a file that makes its own require ESM-only", () => {
    const facts = modules(
      "a.ts",
      [
        'import { createRequire } from "node:module";',
        "const require = createRequire(import.meta.url);",
        'const x = require("x");',
      ].join("\n"),
    );

    expect(facts).toMatchObject({ esm: 2, commonjs: 0 });
    expect(facts.requests).toStrictEqual([
      { specifier: "node:module", kind: "import", isType: false },
    ]);
  });

  it("does not count exports or module that a function takes as a parameter, and counts them again after it", () => {
    const facts = modules(
      "a.js",
      [
        "function wrap(exports, module) { exports.a = 1; module.exports = 2; }",
        "const arrow = (exports) => { exports.b = 1; };",
        "exports.c = 3;",
      ].join("\n"),
    );

    expect(facts.commonjs).toBe(1);
  });

  it("does not count a require bound by an import, a function or a parameter with a default", () => {
    expect(
      modules("a.ts", 'import { require } from "x";\nrequire("y");\n').commonjs,
    ).toBe(0);
    expect(
      modules("a.js", 'function require(id) {}\nrequire("y");\n').commonjs,
    ).toBe(0);
    expect(
      modules("a.js", '((require = 1) => require("y"))();\n').commonjs,
    ).toBe(0);
    expect(
      modules("a.js", "export const exports = {};\nexports.a = 1;\n").commonjs,
    ).toBe(0);
  });

  it("counts require inside a function that shadows another name", () => {
    expect(
      modules("a.js", 'function f(other) { return require("y"); }\n').commonjs,
    ).toBe(1);
  });
});

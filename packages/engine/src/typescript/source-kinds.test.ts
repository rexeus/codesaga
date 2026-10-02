import { describe, expect, it } from "vitest";

import {
  isDeclarationPath,
  isScriptPath,
  parseOptionsOf,
} from "./source-kinds.js";

describe("parseOptionsOf", () => {
  it.each([
    ["a.ts", { lang: "ts", sourceType: "module" }],
    ["a.mts", { lang: "ts", sourceType: "module" }],
    ["a.cts", { lang: "ts", sourceType: "commonjs" }],
    ["a.tsx", { lang: "tsx", sourceType: "module" }],
    ["a.js", { lang: "jsx", sourceType: "unambiguous" }],
    ["a.jsx", { lang: "jsx", sourceType: "unambiguous" }],
    ["a.mjs", { lang: "jsx", sourceType: "module" }],
    ["a.cjs", { lang: "jsx", sourceType: "commonjs" }],
    ["src/App.TS", { lang: "ts", sourceType: "module" }],
  ] as const)("reads %s as %j", (path, expected) => {
    expect(parseOptionsOf(path)).toStrictEqual(expected);
  });
});

describe("isDeclarationPath", () => {
  it("recognizes the declaration files of every module flavor", () => {
    expect(isDeclarationPath("types/index.d.ts")).toBe(true);
    expect(isDeclarationPath("a.d.mts")).toBe(true);
    expect(isDeclarationPath("a.d.cts")).toBe(true);
    expect(isDeclarationPath("a.ts")).toBe(false);
    expect(isDeclarationPath("d.ts")).toBe(false);
    expect(isDeclarationPath("a.d.tsx")).toBe(false);
  });
});

describe("isScriptPath", () => {
  it("accepts TypeScript and JavaScript and nothing else", () => {
    expect(isScriptPath("a.ts")).toBe(true);
    expect(isScriptPath("a.cjs")).toBe(true);
    expect(isScriptPath("a.vue")).toBe(false);
    expect(isScriptPath("a.py")).toBe(false);
    expect(isScriptPath("Makefile")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { exportTargets } from "./exports-map.js";

describe("exportTargets", () => {
  it("takes a string as the target of the package itself only", () => {
    expect(exportTargets("./index.js", ".")).toStrictEqual(["./index.js"]);
    expect(exportTargets("./index.js", "./sub")).toStrictEqual([]);
  });

  it("follows types, import and default in the order the manifest lists them, and skips other conditions", () => {
    const exports = {
      ".": {
        node: "./node.js",
        require: "./index.cjs",
        types: "./index.d.ts",
        import: { types: "./esm.d.ts", default: "./esm.js" },
        default: "./fallback.js",
      },
    };

    expect(exportTargets(exports, ".")).toStrictEqual([
      "./index.d.ts",
      "./esm.d.ts",
      "./esm.js",
      "./fallback.js",
    ]);
  });

  it("reads an exports object of conditions only as the target of the package itself", () => {
    const exports = { import: "./index.js", require: "./index.cjs" };

    expect(exportTargets(exports, ".")).toStrictEqual(["./index.js"]);
    expect(exportTargets(exports, "./sub")).toStrictEqual([]);
  });

  it("reads an array as its entries in order", () => {
    expect(
      exportTargets({ ".": [{ types: "./a.d.ts" }, "./b.js"] }, "."),
    ).toStrictEqual(["./a.d.ts", "./b.js"]);
  });
});

describe("exportTargets subpaths", () => {
  it("matches a subpath exactly before it tries a pattern", () => {
    const exports = {
      "./*": "./dist/*.js",
      "./special": "./dist/other.js",
    };

    expect(exportTargets(exports, "./special")).toStrictEqual([
      "./dist/other.js",
    ]);
    expect(exportTargets(exports, "./plain")).toStrictEqual([
      "./dist/plain.js",
    ]);
  });

  it("matches the pattern with the longest prefix and fills in every star", () => {
    const exports = {
      "./*": "./dist/*.js",
      "./internal/*": { default: "./dist/internal/*/index.js" },
    };

    expect(exportTargets(exports, "./internal/a/b")).toStrictEqual([
      "./dist/internal/a/b/index.js",
    ]);
  });

  it("maps a subpath exported as null to nothing", () => {
    expect(
      exportTargets({ ".": "./a.js", "./hidden": null }, "./hidden"),
    ).toStrictEqual([]);
  });

  it("maps a key it does not list to nothing", () => {
    expect(exportTargets({ ".": "./a.js" }, "./missing")).toStrictEqual([]);
    expect(exportTargets(undefined, ".")).toStrictEqual([]);
  });
});

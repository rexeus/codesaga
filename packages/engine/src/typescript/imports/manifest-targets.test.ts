import { describe, expect, it } from "vitest";

import { manifestTargets } from "./manifest-targets.js";

describe("manifestTargets", () => {
  it("takes a string as the target of the package itself only", () => {
    expect(manifestTargets("./index.js", ".")).toStrictEqual(["./index.js"]);
    expect(manifestTargets("./index.js", "./sub")).toStrictEqual([]);
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

    expect(manifestTargets(exports, ".")).toStrictEqual([
      "./index.d.ts",
      "./esm.d.ts",
      "./esm.js",
      "./fallback.js",
    ]);
  });

  it("reads an exports object of conditions only as the target of the package itself", () => {
    const exports = { import: "./index.js", require: "./index.cjs" };

    expect(manifestTargets(exports, ".")).toStrictEqual(["./index.js"]);
    expect(manifestTargets(exports, "./sub")).toStrictEqual([]);
  });

  it("reads an array as its entries in order", () => {
    expect(
      manifestTargets({ ".": [{ types: "./a.d.ts" }, "./b.js"] }, "."),
    ).toStrictEqual(["./a.d.ts", "./b.js"]);
  });
});

describe("manifestTargets imports", () => {
  it("reads the keys of an imports field, exact and with a star, with the same conditions", () => {
    const imports = {
      "#config": { node: "./node.js", default: "./config.js" },
      "#lib/*": "./src/lib/*.js",
      "#dep": "some-package",
    };

    expect(manifestTargets(imports, "#config")).toStrictEqual(["./config.js"]);
    expect(manifestTargets(imports, "#lib/a/b")).toStrictEqual([
      "./src/lib/a/b.js",
    ]);
    expect(manifestTargets(imports, "#dep")).toStrictEqual(["some-package"]);
    expect(manifestTargets(imports, "#other")).toStrictEqual([]);
  });
});

describe("manifestTargets subpaths", () => {
  it("matches a subpath exactly before it tries a pattern", () => {
    const exports = {
      "./*": "./dist/*.js",
      "./special": "./dist/other.js",
    };

    expect(manifestTargets(exports, "./special")).toStrictEqual([
      "./dist/other.js",
    ]);
    expect(manifestTargets(exports, "./plain")).toStrictEqual([
      "./dist/plain.js",
    ]);
  });

  it("matches the pattern with the longest prefix and fills in every star", () => {
    const exports = {
      "./*": "./dist/*.js",
      "./internal/*": { default: "./dist/internal/*/index.js" },
    };

    expect(manifestTargets(exports, "./internal/a/b")).toStrictEqual([
      "./dist/internal/a/b/index.js",
    ]);
  });

  it("maps a subpath exported as null to nothing", () => {
    expect(
      manifestTargets({ ".": "./a.js", "./hidden": null }, "./hidden"),
    ).toStrictEqual([]);
  });

  it("maps a key it does not list to nothing", () => {
    expect(manifestTargets({ ".": "./a.js" }, "./missing")).toStrictEqual([]);
    expect(manifestTargets(undefined, ".")).toStrictEqual([]);
  });
});

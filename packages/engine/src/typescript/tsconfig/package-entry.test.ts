import { describe, expect, it } from "vitest";

import { entryCandidates, splitPackageSpecifier } from "./package-entry.js";

describe("splitPackageSpecifier", () => {
  it("splits the package name from the subpath, scopes included", () => {
    expect(splitPackageSpecifier("@repo/tsconfig/base.json")).toStrictEqual({
      name: "@repo/tsconfig",
      subpath: "base.json",
    });
    expect(splitPackageSpecifier("@repo/tsconfig")).toStrictEqual({
      name: "@repo/tsconfig",
      subpath: "",
    });
    expect(splitPackageSpecifier("preset/lib/tsconfig")).toStrictEqual({
      name: "preset",
      subpath: "lib/tsconfig",
    });
  });
});

describe("entryCandidates", () => {
  it("tries what exports maps a subpath to before the plain file names", () => {
    const manifest = { exports: { "./node": "./configs/node.json" } };

    expect(entryCandidates(manifest, "node")).toStrictEqual([
      "./configs/node.json",
      "node",
      "node.json",
      "node/tsconfig.json",
    ]);
  });

  it("reads the conditions of an exports target in order and a * pattern", () => {
    const manifest = {
      exports: {
        "./base.json": { default: "./b.json", types: "./b.d.json" },
        "./presets/*": "./presets/*.json",
      },
    };

    expect(entryCandidates(manifest, "base.json").slice(0, 2)).toStrictEqual([
      "./b.json",
      "./b.d.json",
    ]);
    expect(entryCandidates(manifest, "presets/strict")[0]).toBe(
      "./presets/strict.json",
    );
  });

  it("names the tsconfig field, then tsconfig.json, for the package itself", () => {
    expect(entryCandidates({ tsconfig: "base.json" }, "")).toStrictEqual([
      "base.json",
      "tsconfig.json",
    ]);
    expect(entryCandidates({ exports: "./main.json" }, "")).toStrictEqual([
      "./main.json",
      "tsconfig.json",
    ]);
    expect(entryCandidates(undefined, "")).toStrictEqual(["tsconfig.json"]);
  });
});

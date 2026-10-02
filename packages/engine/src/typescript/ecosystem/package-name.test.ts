import { describe, expect, it } from "vitest";

import { classifySpecifier, tableKeyOf } from "./package-name.js";

const known = new Set(["react", "@effect/platform-node", "lodash", "events"]);

describe("classifySpecifier", () => {
  it("names a known package by its name without a subpath, scoped packages included", () => {
    expect(classifySpecifier("react", known)).toStrictEqual({
      kind: "package",
      name: "react",
    });
    expect(classifySpecifier("lodash/fp", known)).toStrictEqual({
      kind: "package",
      name: "lodash",
    });
    expect(
      classifySpecifier("@effect/platform-node/NodeFileSystem", known),
    ).toStrictEqual({ kind: "package", name: "@effect/platform-node" });
  });

  it("names a built-in with or without the node: prefix and without its subpath", () => {
    expect(classifySpecifier("fs", known)).toStrictEqual({
      kind: "builtin",
      name: "fs",
    });
    expect(classifySpecifier("node:fs/promises", known)).toStrictEqual({
      kind: "builtin",
      name: "fs",
    });
    expect(classifySpecifier("node:test", known)).toStrictEqual({
      kind: "builtin",
      name: "test",
    });
  });

  it("reads a declared name that is also a built-in's as a package, except with the node: prefix", () => {
    expect(classifySpecifier("events", known)).toStrictEqual({
      kind: "package",
      name: "events",
    });
    expect(classifySpecifier("node:events", known)).toStrictEqual({
      kind: "builtin",
      name: "events",
    });
  });
});

describe("classifySpecifier undeclared and unnamed", () => {
  it("calls a plausible name that nothing declares undeclared", () => {
    expect(classifySpecifier("src/util", known)).toStrictEqual({
      kind: "undeclared",
      name: "src",
    });
    expect(classifySpecifier("@app/foo", known)).toStrictEqual({
      kind: "undeclared",
      name: "@app/foo",
    });
  });

  it("names nothing for a relative path, an alias symbol, a URL or a malformed name", () => {
    for (const specifier of [
      "./a",
      "../a",
      "/abs",
      "@/components/a",
      "~/a",
      "#internal/a",
      "https://example.com/a.js",
      "@scope",
      "node:",
      "",
    ]) {
      expect(classifySpecifier(specifier, known)).toBeUndefined();
    }
  });
});

describe("tableKeyOf", () => {
  it("keeps the node: prefix of a built-in so the table can tell node:test apart", () => {
    expect(tableKeyOf("node:test")).toBe("node:test");
    expect(tableKeyOf("node:fs/promises")).toBe("node:fs");
    expect(tableKeyOf("fs")).toBe("fs");
    expect(tableKeyOf("vitest")).toBe("vitest");
    expect(tableKeyOf("./a")).toBeUndefined();
  });
});

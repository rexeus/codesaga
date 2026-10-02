import { describe, expect, it } from "vitest";

import { tableKeyOf, targetOf } from "./package-name.js";

describe("targetOf", () => {
  it("names a package by its name without a subpath, scoped packages included", () => {
    expect(targetOf("react")).toStrictEqual({ kind: "package", name: "react" });
    expect(targetOf("lodash/fp")).toStrictEqual({
      kind: "package",
      name: "lodash",
    });
    expect(targetOf("@effect/platform-node/NodeFileSystem")).toStrictEqual({
      kind: "package",
      name: "@effect/platform-node",
    });
  });

  it("names a built-in with or without the node: prefix and without its subpath", () => {
    expect(targetOf("fs")).toStrictEqual({ kind: "builtin", name: "fs" });
    expect(targetOf("node:fs/promises")).toStrictEqual({
      kind: "builtin",
      name: "fs",
    });
    expect(targetOf("node:test")).toStrictEqual({
      kind: "builtin",
      name: "test",
    });
  });

  it("names nothing for a relative path, an alias, a URL or a malformed name", () => {
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
      expect(targetOf(specifier)).toBeUndefined();
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

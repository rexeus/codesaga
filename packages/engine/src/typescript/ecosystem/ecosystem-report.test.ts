import { describe, expect, it } from "vitest";

import { factsWith } from "../../testing/file-facts.js";
import type { ModuleFacts } from "../modules/module-facts.js";
import type { ParsedFile } from "../parsed-file.js";
import { ecosystemOf } from "./ecosystem-report.js";
import type { PackageManifest } from "./read-manifests.js";

const imports = (
  ...specifiers: ReadonlyArray<string>
): ModuleFacts["requests"] =>
  specifiers.map((specifier) => ({ specifier, kind: "import", isType: false }));

const file = (
  path: string,
  specifiers: ReadonlyArray<string>,
  hookCalls = 0,
): ParsedFile => ({
  path,
  lines: 10,
  facts: factsWith({
    modules: { requests: imports(...specifiers) },
    ecosystem: { hookCalls },
  }),
});

const manifest = (
  parts: Partial<Omit<PackageManifest, "path">> = {},
): PackageManifest => ({
  path: "package.json",
  name: null,
  type: null,
  dependencies: [],
  devDependencies: [],
  peerDependencies: [],
  ...parts,
});

describe("ecosystemOf tools", () => {
  it("detects React, Vitest and Effect from imports and from package.json", () => {
    const ecosystem = ecosystemOf(
      [
        file("src/a.tsx", ["react", "react-dom/client", "effect"], 3),
        file("src/b.ts", ["@effect/platform-node", "./local"]),
        file("src/a.test.ts", ["vitest"]),
      ],
      [
        manifest({
          dependencies: ["react", "effect"],
          devDependencies: ["vitest", "typescript"],
        }),
        manifest({ devDependencies: ["vitest"] }),
      ],
    );

    expect(ecosystem.tools).toStrictEqual([
      { name: "Effect", category: "library", files: 2, declaredIn: 1 },
      { name: "Vitest", category: "test", files: 1, declaredIn: 2 },
      { name: "React", category: "framework", files: 1, declaredIn: 1 },
    ]);
  });

  it("detects a tool that is only declared, and node:test only from its prefixed import", () => {
    const ecosystem = ecosystemOf(
      [file("a.test.ts", ["node:test", "test"])],
      [manifest({ devDependencies: ["prettier"] })],
    );

    expect(ecosystem.tools).toStrictEqual([
      { name: "node:test", category: "test", files: 1, declaredIn: 0 },
      { name: "Prettier", category: "format", files: 0, declaredIn: 1 },
    ]);
  });
});

describe("ecosystemOf imports", () => {
  it("lists the most imported packages by importing files, without built-ins and the repository's own packages", () => {
    const ecosystem = ecosystemOf(
      [
        file("a.ts", ["lodash", "@acme/core", "node:fs", "zod"]),
        file("b.ts", ["lodash/fp", "@acme/core/x", "fs/promises", "node:path"]),
        file("c.ts", ["zod", "lodash"]),
      ],
      [manifest({ name: "@acme/core" })],
    );

    expect(ecosystem.packages).toStrictEqual([
      { name: "lodash", files: 3 },
      { name: "zod", files: 2 },
    ]);
    expect(ecosystem.nodeBuiltins).toStrictEqual([
      { name: "fs", files: 2 },
      { name: "path", files: 1 },
    ]);
  });

  it("lists ten packages at most", () => {
    const names = Array.from({ length: 14 }, (_, index) => `pkg-${index}`);

    expect(ecosystemOf([file("a.ts", names)], []).packages).toHaveLength(10);
  });

  it("counts distinct dependency names over the manifests and the hook calls with their files", () => {
    const ecosystem = ecosystemOf(
      [file("a.tsx", [], 4), file("b.tsx", [], 1), file("c.ts", [])],
      [
        manifest({ dependencies: ["a", "b"], devDependencies: ["x"] }),
        manifest({ dependencies: ["b", "c"], devDependencies: ["x", "y"] }),
      ],
    );

    expect(ecosystem.dependencies).toStrictEqual({
      manifests: 2,
      runtime: 3,
      dev: 2,
    });
    expect(ecosystem.hooks).toStrictEqual({ calls: 5, files: 2 });
  });
});

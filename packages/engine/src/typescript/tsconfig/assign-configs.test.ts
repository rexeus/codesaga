import { describe, expect, it } from "vitest";

import { loadedConfig } from "../../testing/tsconfig.js";
import { governingConfig, selectionOf } from "./assign-configs.js";
import type { LoadedTsconfig } from "./config-file.js";

const project = { checksJs: false, isBase: false };

const governing = (
  path: string,
  configs: ReadonlyArray<LoadedTsconfig>,
  options: Partial<typeof project> = {},
): string | undefined =>
  governingConfig(
    configs.map((config) => selectionOf(config, { ...project, ...options })),
    path,
  );

describe("governingConfig selection", () => {
  it("selects every file below a config without include, files and exclude", () => {
    const config = loadedConfig("packages/a/tsconfig.json");

    expect(governing("packages/a/src/x.ts", [config])).toBe(config.path);
    expect(governing("packages/b/src/x.ts", [config])).toBeUndefined();
  });

  it("reads a pattern without an extension as a directory and honors exclude", () => {
    const config = loadedConfig("tsconfig.json", {
      include: ["src", "scripts/*.ts"],
      exclude: ["src/generated", "**/*.test.ts"],
    });

    expect(governing("src/deep/x.ts", [config])).toBe("tsconfig.json");
    expect(governing("scripts/build.ts", [config])).toBe("tsconfig.json");
    expect(governing("scripts/sub/build.ts", [config])).toBeUndefined();
    expect(governing("src/generated/x.ts", [config])).toBeUndefined();
    expect(governing("src/x.test.ts", [config])).toBeUndefined();
    expect(governing("lib/x.ts", [config])).toBeUndefined();
  });

  it("selects a file listed in files even when exclude names it, and nothing else", () => {
    const config = loadedConfig("tsconfig.json", {
      files: ["./main.ts"],
      exclude: ["main.ts"],
    });

    expect(governing("main.ts", [config])).toBe("tsconfig.json");
    expect(governing("other.ts", [config])).toBeUndefined();
  });

  it("selects nothing for the empty files of a solution config", () => {
    const solution = loadedConfig("tsconfig.json", { files: [] });

    expect(governing("src/x.ts", [solution])).toBeUndefined();
  });

  it("reads inherited include relative to the config that wrote it, and ${configDir} to the config that governs", () => {
    const shared = loadedConfig("configs/base.json", { include: ["../src"] });
    const inheriting = loadedConfig("tsconfig.json", { extends: [shared] });
    const templated = loadedConfig("packages/a/tsconfig.json", {
      include: ["${configDir}/lib"],
    });

    expect(governing("src/x.ts", [inheriting])).toBe("tsconfig.json");
    expect(governing("lib/x.ts", [inheriting])).toBeUndefined();
    expect(governing("packages/a/lib/x.ts", [templated])).toBe(templated.path);
    expect(governing("lib/x.ts", [templated])).toBeUndefined();
  });

  it("does not select node_modules unless exclude says otherwise", () => {
    const config = loadedConfig("tsconfig.json");

    expect(governing("node_modules/x/index.ts", [config])).toBeUndefined();
  });
});

describe("governingConfig choice", () => {
  const root = loadedConfig("tsconfig.json");
  const nested = loadedConfig("packages/a/tsconfig.json");
  const build = loadedConfig("packages/a/tsconfig.build.json");

  it("prefers the deepest config, then a plain tsconfig.json over a variant", () => {
    expect(governing("packages/a/x.ts", [root, build, nested])).toBe(
      "packages/a/tsconfig.json",
    );
    expect(governing("packages/b/x.ts", [root, build, nested])).toBe(
      "tsconfig.json",
    );
    expect(governing("packages/a/x.ts", [build])).toBe(
      "packages/a/tsconfig.build.json",
    );
  });

  it("lets a shared base govern nothing it does not select itself", () => {
    const shared = loadedConfig("tsconfig.base.json");

    expect(governing("src/x.ts", [shared], { isBase: true })).toBeUndefined();
    expect(governing("src/x.ts", [shared], { isBase: false })).toBe(
      "tsconfig.base.json",
    );
  });

  it("governs JavaScript only for a config that checks it", () => {
    const config = loadedConfig("tsconfig.json");

    expect(governing("src/x.js", [config])).toBeUndefined();
    expect(governing("src/x.js", [config], { checksJs: true })).toBe(
      "tsconfig.json",
    );
    expect(governing("src/x.ts", [config])).toBe("tsconfig.json");
  });
});

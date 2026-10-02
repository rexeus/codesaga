import { describe, expect, it } from "vitest";

import { loadedConfig } from "../../testing/tsconfig.js";
import { aliasesOf, matchAlias } from "./ts-aliases.js";

describe("aliasesOf", () => {
  it("reads paths relative to baseUrl, and baseUrl relative to its config", () => {
    const aliases = aliasesOf(
      loadedConfig("packages/app/tsconfig.json", {
        options: { baseUrl: "src", paths: { "@/*": ["*", "shared/*"] } },
      }),
    );

    expect(aliases).toStrictEqual({
      baseUrl: "packages/app/src",
      patterns: [
        {
          pattern: "@/*",
          targets: ["packages/app/src/*", "packages/app/src/shared/*"],
        },
      ],
    });
  });

  it("reads paths relative to the config when there is no baseUrl", () => {
    const aliases = aliasesOf(
      loadedConfig("packages/app/tsconfig.json", {
        options: { paths: { "~/*": ["./lib/*"] } },
      }),
    );

    expect(aliases.baseUrl).toBeUndefined();
    expect(aliases.patterns).toStrictEqual([
      { pattern: "~/*", targets: ["packages/app/lib/*"] },
    ]);
  });
});

describe("aliasesOf extends", () => {
  it("reads an option from the config that sets it, relative to that config", () => {
    const base = loadedConfig("config/tsconfig.base.json", {
      options: { baseUrl: "..", paths: { "#/*": ["src/*"] } },
    });
    const aliases = aliasesOf(
      loadedConfig("packages/app/tsconfig.json", { extends: [base] }),
    );

    expect(aliases).toStrictEqual({
      baseUrl: "",
      patterns: [{ pattern: "#/*", targets: ["src/*"] }],
    });
  });

  it("lets a later extended config and the config itself replace an option as a whole", () => {
    const first = loadedConfig("a.json", {
      options: { paths: { "a/*": ["a/*"] } },
    });
    const second = loadedConfig("b.json", {
      options: { paths: { "b/*": ["b/*"] } },
    });
    const own = loadedConfig("tsconfig.json", {
      extends: [first, second],
    });

    expect(aliasesOf(own).patterns.map(({ pattern }) => pattern)).toStrictEqual(
      ["b/*"],
    );
  });

  it("reads ${configDir} as the directory of the governing config", () => {
    const base = loadedConfig("base/tsconfig.json", {
      options: { paths: { "@/*": ["${configDir}/src/*"] } },
    });
    const aliases = aliasesOf(
      loadedConfig("packages/app/tsconfig.json", { extends: [base] }),
    );

    expect(aliases.patterns[0]?.targets).toStrictEqual(["packages/app/src/*"]);
  });

  it("has no aliases for a config that sets none", () => {
    expect(aliasesOf(loadedConfig("tsconfig.json"))).toStrictEqual({
      baseUrl: undefined,
      patterns: [],
    });
  });
});

describe("matchAlias", () => {
  const aliases = aliasesOf(
    loadedConfig("tsconfig.json", {
      options: {
        paths: {
          "*": ["types/*"],
          "@app/*": ["src/app/*"],
          "@app/core/*": ["src/core/*"],
          config: ["src/config.ts"],
        },
      },
    }),
  );

  it("prefers an exact pattern, then the longest prefix", () => {
    expect(matchAlias(aliases, "config")?.locations).toStrictEqual([
      "src/config.ts",
    ]);
    expect(matchAlias(aliases, "@app/core/a")?.locations).toStrictEqual([
      "src/core/a",
    ]);
    expect(matchAlias(aliases, "@app/x")?.locations).toStrictEqual([
      "src/app/x",
    ]);
  });

  it("calls a pattern with a prefix of its own specific, and a bare star not", () => {
    expect(matchAlias(aliases, "@app/x")?.isSpecific).toBe(true);
    expect(matchAlias(aliases, "react")?.isSpecific).toBe(false);
  });

  it("matches nothing without a pattern for the specifier", () => {
    const scoped = aliasesOf(
      loadedConfig("tsconfig.json", {
        options: { paths: { "@app/*": ["src/*"] } },
      }),
    );

    expect(matchAlias(scoped, "react")).toBeUndefined();
  });
});

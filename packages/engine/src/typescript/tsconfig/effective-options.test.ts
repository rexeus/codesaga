import { describe, expect, it } from "vitest";

import { loadedConfig } from "../../testing/tsconfig.js";
import { chainOf, postureOf, unresolvedOf } from "./effective-options.js";

const base = loadedConfig("tsconfig.base.json", {
  options: { strict: true, target: "ES2022", exactOptionalPropertyTypes: true },
});

describe("postureOf", () => {
  it("lets a config override what it extends and inherit the rest", () => {
    const config = loadedConfig("packages/a/tsconfig.json", {
      extends: [base],
      options: { noUncheckedIndexedAccess: true, target: "ES2023" },
    });

    expect(postureOf(config, false)).toMatchObject({
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      noImplicitOverride: false,
      target: "ES2023",
      module: null,
    });
  });

  it("applies a later entry of an extends array over an earlier one", () => {
    const loose = loadedConfig("loose.json", { options: { strict: false } });

    const config = loadedConfig("tsconfig.json", { extends: [base, loose] });

    expect(postureOf(config, true).strict).toBe(false);
    expect(
      postureOf(loadedConfig("tsconfig.json", { extends: [loose, base] }), true)
        .strict,
    ).toBe(true);
  });

  it("is unknown where an unresolved extends may have set the option", () => {
    const config = loadedConfig("tsconfig.json", {
      extends: ["@tsconfig/strictest/tsconfig.json"],
      options: { noImplicitOverride: true },
    });

    expect(postureOf(config, false)).toMatchObject({
      strict: "unknown",
      exactOptionalPropertyTypes: "unknown",
      noImplicitOverride: true,
      target: null,
    });
  });

  it("is decided by a resolved config that comes after the unresolved one", () => {
    const config = loadedConfig("tsconfig.json", {
      extends: ["@tsconfig/node20/tsconfig.json", base],
    });

    expect(postureOf(config, false).strict).toBe(true);
  });
});

describe("postureOf defaults", () => {
  it("defaults strict by the declared TypeScript, and leaves it unknown without one", () => {
    const config = loadedConfig("tsconfig.json");

    expect(postureOf(config, true).strict).toBe(true);
    expect(postureOf(config, false).strict).toBe(false);
    expect(postureOf(config, "unknown").strict).toBe("unknown");
  });

  it("lists the parts that differ from strict", () => {
    const strictButLoose = loadedConfig("a.json", {
      extends: [base],
      options: { strictNullChecks: false, noImplicitAny: true },
    });
    const looseButPartly = loadedConfig("b.json", {
      options: { strict: false, noImplicitAny: true },
    });

    expect(postureOf(strictButLoose, false).strictExceptions).toStrictEqual([
      "strictNullChecks",
    ]);
    expect(postureOf(looseButPartly, false).strictExceptions).toStrictEqual([
      "noImplicitAny",
    ]);
  });

  it("calls a value that is not a boolean unknown", () => {
    const config = loadedConfig("tsconfig.json", {
      options: { strict: "yes", target: 5 },
    });

    expect(postureOf(config, false)).toMatchObject({
      strict: "unknown",
      target: null,
    });
  });
});

describe("chainOf and unresolvedOf", () => {
  const middle = loadedConfig("packages/tsconfig.json", {
    extends: [base, "@scope/preset"],
  });
  const leaf = loadedConfig("packages/a/tsconfig.json", {
    extends: [middle, "@scope/preset"],
  });

  it("lists the resolved configs base first, each once", () => {
    expect(chainOf(leaf)).toStrictEqual([
      "tsconfig.base.json",
      "packages/tsconfig.json",
    ]);
  });

  it("lists each unresolved specifier once, wherever in the chain it was met", () => {
    expect(unresolvedOf(leaf)).toStrictEqual(["@scope/preset"]);
  });
});

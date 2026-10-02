import { describe, expect, it } from "vitest";

import { loadedConfig } from "../../testing/tsconfig.js";
import { strictnessOf } from "./strictness.js";

const typescript = { declared: "^5.9.0", majors: [5] };

const analysis = (
  configs: ReadonlyArray<ReturnType<typeof loadedConfig>>,
  paths: ReadonlyArray<string>,
) => strictnessOf({ configs, typescript }, paths);

describe("strictnessOf governance", () => {
  const root = loadedConfig("tsconfig.json", { options: { strict: true } });
  const child = loadedConfig("packages/a/tsconfig.json", {
    extends: [root],
    options: { strict: false },
  });
  const paths = ["src/r.ts", "packages/a/src/x.ts"];

  it("lets a root tsconfig.json that a child extends govern its own tree, the deepest config winning", () => {
    const { section, strictOf } = analysis([root, child], paths);

    expect(
      section.configs.map(({ path, files }) => [path, files]),
    ).toStrictEqual([
      ["packages/a/tsconfig.json", 1],
      ["tsconfig.json", 1],
    ]);
    expect(section.ungovernedFiles).toBe(0);
    expect(strictOf(["src/r.ts"])).toBe(true);
    expect(strictOf(paths)).toBe("mixed");
  });

  it("treats an extended config that is not a plain tsconfig.json and selects nothing as a base that governs nothing", () => {
    const base = loadedConfig("tsconfig.base.json", {
      options: { strict: true },
    });
    const project = loadedConfig("packages/a/tsconfig.json", {
      extends: [base],
    });

    const { section } = analysis([base, project], paths);

    expect(
      section.configs.find(({ path }) => path === "tsconfig.base.json")?.files,
    ).toBe(0);
    expect(section.governedFiles).toBe(1);
    expect(section.ungovernedFiles).toBe(1);
  });

  it("lets a config govern what the include it inherits selects, relative to the config that wrote it", () => {
    const shared = loadedConfig("base.json", { include: ["src"] });
    const project = loadedConfig("packages/a/tsconfig.json", {
      extends: [shared],
    });

    const { section } = analysis([project], paths);

    expect(section.configs[0]?.files).toBe(1);
    expect(section.ungovernedFiles).toBe(1);
  });
});

describe("strictnessOf counts", () => {
  it("counts TypeScript files no config governs apart from JavaScript files outside the configs", () => {
    const config = loadedConfig("tsconfig.json", { include: ["src"] });

    const { section } = analysis(
      [config],
      ["src/a.ts", "lib/b.ts", "lib/c.d.ts", "src/d.js", "lib/e.mjs"],
    );

    expect(section).toMatchObject({
      governedFiles: 1,
      ungovernedFiles: 2,
      jsFilesOutsideConfigs: 2,
    });
  });
});

const byDefault = (majors: ReadonlyArray<number>) =>
  strictnessOf({ configs: [], typescript: { declared: "x", majors } }, [])
    .section.typescript.strictByDefault;

describe("strictnessOf strict by default", () => {
  it("is on when every declared major defaults strict, off when none does, unknown when they differ or none is known", () => {
    expect(byDefault([6, 7])).toBe(true);
    expect(byDefault([5])).toBe(false);
    expect(byDefault([5, 6])).toBe("unknown");
    expect(byDefault([])).toBe("unknown");
  });
});

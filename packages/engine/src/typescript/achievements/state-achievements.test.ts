import { describe, expect, it } from "vitest";

import { factsWith } from "../../testing/file-facts.js";
import {
  configPosture,
  strictnessBlock,
} from "../../testing/typescript-blocks.js";
import type { ParsedFile } from "../parsed-file.js";
import { stateAchievementsOf } from "./state-achievements.js";

type Counts = Parameters<typeof factsWith>[0];

const ESM: Counts = { modules: { esm: 1 } };

const file = (path: string, counts: Counts): ParsedFile => ({
  path,
  lines: 10,
  facts: factsWith(counts),
});

/** `count` production TypeScript files `src/f<i>.ts`, the first `marked` with `counts`. */
const files = (
  count: number,
  marked = 0,
  counts: Counts = {},
): ReadonlyArray<ParsedFile> =>
  Array.from({ length: count }, (_, index) =>
    file(`src/f${index}.ts`, {
      modules: { esm: 1 },
      ...(index < marked ? counts : {}),
    }),
  );

const strict = strictnessBlock([configPosture("tsconfig.json", 60, true)]);

const achievement = (
  parsed: ReadonlyArray<ParsedFile>,
  kind: string,
  strictness = strict,
) =>
  stateAchievementsOf(parsed, strictness).find((entry) => entry.kind === kind);

describe("stateAchievementsOf", () => {
  it("lists the four in order, reached or not, as states without a day", () => {
    const list = stateAchievementsOf(files(60), strict);

    expect(
      list.map(({ kind, reached, holds, reachedAt }) => [
        kind,
        reached,
        holds,
        reachedAt,
      ]),
    ).toStrictEqual([
      ["any-free", true, "state", null],
      ["strict-throughout", true, "state", null],
      ["esm-only", true, "state", null],
      ["no-ts-ignore", true, "state", null],
    ]);
  });

  it("is empty without a production TypeScript file", () => {
    expect(
      stateAchievementsOf(
        [file("src/a.js", ESM), file("src/a.test.ts", ESM)],
        strict,
      ),
    ).toStrictEqual([]);
  });
});

describe("any-free", () => {
  it("needs 50 production TypeScript files without an explicit any", () => {
    expect(achievement(files(50), "any-free")).toStrictEqual({
      kind: "any-free",
      title: "Any-free",
      reached: true,
      reachedAt: null,
      holds: "state",
      detail: "No explicit any in 50 production TypeScript files.",
      progress: null,
    });
    expect(achievement(files(49), "any-free")).toMatchObject({
      reached: false,
      detail: "49 production TypeScript files; any-free needs at least 50.",
      progress: { value: 49, target: 50, unit: "production TypeScript files" },
    });
  });

  it("is lost by one explicit any, and counts the files without one", () => {
    expect(
      achievement(files(50, 1, { typeSafety: { any: 1 } }), "any-free"),
    ).toMatchObject({
      reached: false,
      detail: "1 of 50 production TypeScript files use an explicit any.",
      progress: { value: 49, target: 50, unit: "production files without any" },
    });
  });

  it("ignores tests and JavaScript", () => {
    const parsed = [
      ...files(50),
      file("src/a.test.ts", { typeSafety: { any: 3 } }),
      file("src/b.js", { typeSafety: { any: 3 } }),
    ];

    expect(achievement(parsed, "any-free")?.reached).toBe(true);
  });
});

describe("strict-throughout", () => {
  it("needs every file under a strict config, among at least 10 production TypeScript files", () => {
    expect(achievement(files(10), "strict-throughout")).toMatchObject({
      reached: true,
      detail: "Every one of 60 files lies under a strict tsconfig.",
    });
    expect(achievement(files(9), "strict-throughout")).toMatchObject({
      reached: false,
      progress: { value: 9, target: 10, unit: "production TypeScript files" },
    });
  });

  it("is lost by a config that is not strict, a file under none, or an unknown posture", () => {
    const loose = strictnessBlock([
      configPosture("tsconfig.json", 40, true),
      configPosture("apps/tsconfig.json", 20, false),
    ]);
    expect(achievement(files(10), "strict-throughout", loose)).toMatchObject({
      reached: false,
      detail: "40 of 60 files lie under a strict tsconfig.",
      progress: {
        value: 40,
        target: 60,
        unit: "files under a strict tsconfig",
      },
    });
    const outside = strictnessBlock(
      [configPosture("tsconfig.json", 40, true)],
      {
        ungovernedFiles: 2,
      },
    );
    expect(achievement(files(10), "strict-throughout", outside)?.reached).toBe(
      false,
    );
    const unknown = strictnessBlock([
      { ...configPosture("tsconfig.json", 40, true), strict: "unknown" },
    ]);
    expect(achievement(files(10), "strict-throughout", unknown)?.reached).toBe(
      false,
    );
  });

  it("ignores a config that governs no file", () => {
    const withUnused = strictnessBlock([
      configPosture("tsconfig.json", 40, true),
      configPosture("unused/tsconfig.json", 0, false),
    ]);

    expect(
      achievement(files(10), "strict-throughout", withUnused)?.reached,
    ).toBe(true);
  });
});

describe("esm-only", () => {
  it("needs 10 production module files and no CommonJS among them", () => {
    expect(achievement(files(10), "esm-only")).toMatchObject({
      reached: true,
      detail: "No CommonJS in 10 production module files.",
    });
    expect(achievement(files(9), "esm-only")).toMatchObject({
      reached: false,
      progress: { value: 9, target: 10, unit: "production module files" },
    });
  });

  it("is lost by one production file with CommonJS, but not by one in a test", () => {
    const parsed = [
      ...files(10),
      file("src/c.cjs", { modules: { commonjs: 1 } }),
    ];
    expect(achievement(parsed, "esm-only")).toMatchObject({
      reached: false,
      detail: "1 of 11 production module files use CommonJS.",
      progress: {
        value: 10,
        target: 11,
        unit: "production module files without CommonJS",
      },
    });
    const inTest = [
      ...files(10),
      file("src/c.test.ts", { modules: { commonjs: 1 } }),
    ];
    expect(achievement(inTest, "esm-only")?.reached).toBe(true);
  });
});

describe("no-ts-ignore", () => {
  it("is lost by one @ts-ignore or one @ts-nocheck, not by @ts-expect-error", () => {
    expect(achievement(files(10), "no-ts-ignore")?.reached).toBe(true);
    expect(
      achievement(
        files(10, 1, { typeSafety: { tsIgnore: 1 } }),
        "no-ts-ignore",
      ),
    ).toMatchObject({
      reached: false,
      detail: "1 of 10 production files hold a @ts-ignore or @ts-nocheck.",
      progress: {
        value: 9,
        target: 10,
        unit: "production files without @ts-ignore or @ts-nocheck",
      },
    });
    expect(
      achievement(
        files(10, 1, { typeSafety: { tsNocheck: 1 } }),
        "no-ts-ignore",
      )?.reached,
    ).toBe(false);
    expect(
      achievement(
        files(10, 3, { typeSafety: { tsExpectError: 3 } }),
        "no-ts-ignore",
      )?.reached,
    ).toBe(true);
  });

  it("needs 10 production TypeScript files", () => {
    expect(achievement(files(9), "no-ts-ignore")).toMatchObject({
      reached: false,
      progress: { value: 9, target: 10, unit: "production TypeScript files" },
    });
  });
});

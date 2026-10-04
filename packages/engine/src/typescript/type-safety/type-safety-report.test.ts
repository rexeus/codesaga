import { describe, expect, it } from "vitest";

import { factsWith } from "../../testing/file-facts.js";
import type { ParsedFile } from "../parsed-file.js";
import type { TypeSafetyFacts } from "./type-safety-facts.js";
import {
  productionEscapesPer1000,
  typeSafetyOf,
} from "./type-safety-report.js";

const file = (
  path: string,
  lines: number,
  counts: Partial<TypeSafetyFacts> = {},
): ParsedFile => ({ path, lines, facts: factsWith({ typeSafety: counts }) });

const files = [
  file("src/a.ts", 600, {
    any: 3,
    anyOutsideAssertions: 3,
    nonNull: 1,
    satisfies: 2,
  }),
  file("src/b.ts", 400, {}),
  file("src/c.test.ts", 100, {
    assertions: 5,
    assertionChains: 5,
    any: 1,
    anyOutsideAssertions: 1,
  }),
];

describe("typeSafetyOf rates", () => {
  it("keeps production code and tests apart, each with its own denominator", () => {
    const { production, tests } = typeSafetyOf(files);

    expect([
      production.files,
      production.lines,
      tests.files,
      tests.lines,
    ]).toStrictEqual([2, 1000, 1, 100]);
    expect(production.counts).toMatchObject({
      any: 3,
      nonNull: 1,
      assertions: 0,
    });
    expect(tests.counts).toMatchObject({ any: 1, assertions: 5 });
  });

  it("adds the escapes and rates them per 1,000 lines, counterparts included", () => {
    const { production, tests } = typeSafetyOf(files);

    expect(production).toMatchObject({
      escapes: 4,
      escapesPer1000: 4,
      filesWithEscape: 1,
      escapeFileShare: 0.5,
    });
    expect(production.per1000).toMatchObject({ any: 3, satisfies: 2 });
    expect(tests).toMatchObject({ escapes: 6, escapesPer1000: 60 });
  });

  it("counts a site once: as any and as unknown as T are one assertion chain, and benign any is none", () => {
    const { production } = typeSafetyOf([
      file("a.ts", 1000, {
        any: 4,
        asAny: 1,
        benignAny: 2,
        anyOutsideAssertions: 1,
        assertions: 3,
        doubleAssertions: 1,
        assertionChains: 2,
      }),
    ]);

    expect(production.escapes).toBe(3);
  });
});

describe("typeSafetyOf lists", () => {
  it("lists the files with a ts-nocheck, five at most, in path order, tests included", () => {
    const nocheck = ["f", "e", "d", "c", "b", "a"].map((name) =>
      file(`src/${name}.ts`, 10, { tsNocheck: 1 }),
    );

    expect(
      typeSafetyOf([...nocheck, file("src/z.test.ts", 10, { tsNocheck: 1 })])
        .nocheckFiles,
    ).toStrictEqual([
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
      "src/d.ts",
      "src/e.ts",
    ]);
  });

  it("reports empty sets as zeros", () => {
    const { tests } = typeSafetyOf([file("a.ts", 10)]);

    expect(tests).toMatchObject({
      files: 0,
      lines: 0,
      escapes: 0,
      escapesPer1000: 0,
      escapeFileShare: 0,
    });
  });
});

describe("productionEscapesPer1000", () => {
  it("rates the production files and ignores tests", () => {
    expect(
      productionEscapesPer1000([
        file("a.ts", 500, { nonNull: 2 }),
        file("a.test.ts", 500, { nonNull: 50 }),
      ]),
    ).toBe(4);
  });

  it("ignores the files of a test-support folder like tests", () => {
    expect(
      productionEscapesPer1000([
        file("src/a.ts", 500, { nonNull: 2 }),
        file("src/testing/helper.ts", 500, { nonNull: 50 }),
      ]),
    ).toBe(4);
  });

  it("is undefined where no production line exists", () => {
    expect(
      productionEscapesPer1000([file("a.test.ts", 50, { any: 1 })]),
    ).toBeUndefined();
  });
});

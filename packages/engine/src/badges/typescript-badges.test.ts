import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import type { TerritoryTypeScript } from "../report/typescript-territory.js";
import { quietTerritory } from "../testing/territory-badge-input.js";
import { territoryBadges } from "./territory-badges.js";

const now = DateTime.makeUnsafe("2026-07-01T00:00:00Z");

/** A territory of TypeScript that earns none of the four badges, with `overrides` on its figures. */
const figures = (
  overrides: Partial<TerritoryTypeScript> = {},
): TerritoryTypeScript => ({
  files: 12,
  codeLines: 1_200,
  productionTypeScriptFiles: 12,
  escapesPer1000: 2,
  strict: true,
  noUncheckedIndexedAccess: false,
  functions: 100,
  over15Share: 0.05,
  maxComplexity: 20,
  inCycle: false,
  ...overrides,
});

const badgesOf = (overrides: Partial<TerritoryTypeScript>) =>
  territoryBadges(quietTerritory({ typescript: figures(overrides) }), now);

const kindsOfFigures = (typescript: TerritoryTypeScript) =>
  territoryBadges(quietTerritory({ typescript }), now).map(({ kind }) => kind);

const kindsOf = (overrides: Partial<TerritoryTypeScript>) =>
  badgesOf(overrides).map(({ kind }) => kind);

describe("type-safe", () => {
  it("needs 10 production TypeScript files and no escape hatch once rounded to one decimal", () => {
    expect(
      kindsOf({ productionTypeScriptFiles: 10, escapesPer1000: 0 }),
    ).toStrictEqual(["type-safe"]);
    expect(
      kindsOf({ productionTypeScriptFiles: 10, escapesPer1000: 0.049 }),
    ).toStrictEqual(["type-safe"]);
    expect(
      kindsOf({ productionTypeScriptFiles: 10, escapesPer1000: 0.05 }),
    ).toStrictEqual([]);
    expect(
      kindsOf({ productionTypeScriptFiles: 9, escapesPer1000: 0 }),
    ).toStrictEqual([]);
  });

  it("is not earned by a territory of JavaScript or one without production lines", () => {
    const { productionTypeScriptFiles: _files, ...javaScript } = figures({
      escapesPer1000: 0,
    });
    const { escapesPer1000: _rate, ...withoutLines } = figures({
      productionTypeScriptFiles: 12,
    });

    expect(kindsOfFigures(javaScript)).toStrictEqual([]);
    expect(kindsOfFigures(withoutLines)).toStrictEqual([]);
  });

  it("says the files and the rate, in the code category", () => {
    expect(
      badgesOf({ productionTypeScriptFiles: 12, escapesPer1000: 0 }),
    ).toStrictEqual([
      {
        kind: "type-safe",
        category: "code",
        label: "Type-safe",
        evidence:
          "12 production TypeScript files with 0.0 escape hatches per 1,000 production lines.",
      },
    ]);
  });
});

describe("strict", () => {
  it("needs strict and noUncheckedIndexedAccess on every governing config", () => {
    expect(
      kindsOf({ strict: true, noUncheckedIndexedAccess: true }),
    ).toStrictEqual(["strict"]);
    expect(
      kindsOf({ strict: true, noUncheckedIndexedAccess: false }),
    ).toStrictEqual([]);
    expect(
      kindsOf({ strict: "mixed", noUncheckedIndexedAccess: true }),
    ).toStrictEqual([]);
    expect(
      kindsOf({ strict: true, noUncheckedIndexedAccess: "unknown" }),
    ).toStrictEqual([]);
    const {
      strict: _strict,
      noUncheckedIndexedAccess: _indexed,
      ...ungoverned
    } = figures();
    expect(kindsOfFigures(ungoverned)).toStrictEqual([]);
  });
});

describe("complex-logic", () => {
  it("needs 20 production functions and 10% of them at 15 or more", () => {
    expect(kindsOf({ functions: 20, over15Share: 0.1 })).toStrictEqual([
      "complex-logic",
    ]);
    expect(kindsOf({ functions: 19, over15Share: 0.1 })).toStrictEqual([]);
    expect(kindsOf({ functions: 20, over15Share: 0.0999 })).toStrictEqual([]);
  });

  it("says how many functions and the hardest score", () => {
    expect(
      badgesOf({ functions: 325, over15Share: 0.1233, maxComplexity: 29 })[0],
    ).toStrictEqual({
      kind: "complex-logic",
      category: "code",
      label: "Complex logic",
      evidence:
        "40 of 325 production functions (12%) score 15 or more; the hardest scores 29.",
    });
  });
});

describe("in-a-cycle", () => {
  it("is earned when a file cycle runs through the territory", () => {
    expect(badgesOf({ inCycle: true })).toStrictEqual([
      {
        kind: "in-a-cycle",
        category: "code",
        label: "In a cycle",
        evidence:
          "Production files import each other by value in a cycle that runs through this territory and out of it.",
      },
    ]);
    expect(kindsOf({ inCycle: false })).toStrictEqual([]);
    const { inCycle: _inCycle, ...withoutMap } = figures();
    expect(kindsOfFigures(withoutMap)).toStrictEqual([]);
  });
});

describe("TypeScript badges", () => {
  it("are absent without the deep dive, and for an `other` territory", () => {
    expect(
      territoryBadges(quietTerritory({ typescript: undefined }), now),
    ).toStrictEqual([]);
    expect(
      territoryBadges(
        quietTerritory({
          kind: "other",
          typescript: figures({ inCycle: true }),
        }),
        now,
      ),
    ).toStrictEqual([]);
  });
});

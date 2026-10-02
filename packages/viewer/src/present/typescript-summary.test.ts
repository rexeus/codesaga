import { describe, expect, it } from "vitest";

import { sampleBlock, sampleDeepDive } from "../testing/reports.js";
import { hasTypeScriptFiles, typeScriptState } from "./typescript-summary.js";

const deepDive = sampleDeepDive();

const stateOf = (block: Parameters<typeof typeScriptState>[0]) =>
  typeScriptState(block, true);

describe("coverage", () => {
  it("says how many files were read and what was left out", () => {
    const state = stateOf(deepDive);

    expect(state.coverage).toEqual({
      headline: "338 of 345 files read",
      notes: [
        "5 declaration files counted, not read.",
        "Skipped: 1 minified, 1 with a syntax error.",
        "Parser: oxc-parser 0.152.0.",
      ],
    });
  });

  it("names a parser that did not load and leaves out what did not happen", () => {
    const state = stateOf({
      coverage: {
        files: 3,
        parsed: 0,
        declarationFiles: 0,
        skipped: { "parser-unavailable": 3 },
        parser: { name: "oxc-parser", version: null },
      },
    });

    expect(state.coverage.notes).toEqual([
      "Skipped: 3 without a parser.",
      "Parser: oxc-parser, not loaded.",
    ]);
  });
});

describe("typeScriptState", () => {
  it("sums the code up in one figure per block the report has", () => {
    const state = stateOf(deepDive);

    expect(state.kind).toBe("ready");
    expect(
      state.kind === "ready" && state.figures.map(({ value }) => value),
    ).toEqual(["5.0", "87%", "2.6%", "3", "1,420"]);
  });

  it("explains each figure with the counts behind it", () => {
    const state = stateOf(deepDive);

    // 191 sites; 294 of 338 governed files are strict (the admin config is not);
    // 47 of 1,840 functions score 15 or more; 1 cycle exists only through types
    expect(
      state.kind === "ready" && state.figures.map(({ note }) => note),
    ).toEqual([
      "per 1,000 production lines · 191 sites",
      "of governed files compile with strict",
      "score 15 or more · 47 of 1,840",
      "between production files · 1 more by types only",
      "in 76 test files",
    ]);
  });

  it("leaves out the figure of a block the report does not carry", () => {
    const state = stateOf({
      coverage: deepDive.coverage,
      strictness: sampleBlock("strictness"),
      functions: sampleBlock("functions"),
      imports: sampleBlock("imports"),
    });

    expect(
      state.kind === "ready" && state.figures.map(({ label }) => label),
    ).toEqual(["Strict mode", "Complex functions", "Import cycles"]);
  });

  it("says no tsconfig governs a file instead of a share", () => {
    const state = stateOf({
      ...deepDive,
      strictness: {
        ...sampleBlock("strictness"),
        configs: [],
        governedFiles: 0,
      },
    });

    expect(
      state.kind === "ready" &&
        state.figures.find(({ label }) => label === "Strict mode"),
    ).toMatchObject({ value: "No tsconfig", note: "no config governs a file" });
  });

  it("does not take zero cases for none when the runner is not known", () => {
    const state = stateOf({
      ...deepDive,
      tests: { ...sampleBlock("tests"), cases: 0 },
    });

    expect(
      state.kind === "ready" &&
        state.figures.find(({ label }) => label === "Test cases")?.note,
    ).toBe("none found in 76 test files by the runners' call shapes");
  });
});

describe("typeScriptState without an analysis", () => {
  it("shows only a calm note when the parser did not load", () => {
    const state = stateOf({
      coverage: {
        files: 40,
        parsed: 0,
        declarationFiles: 0,
        skipped: { "parser-unavailable": 40 },
        parser: { name: "oxc-parser", version: null },
        unavailable: "the native binding is missing",
      },
    });

    expect(state).toMatchObject({
      kind: "unavailable",
      message:
        "The TypeScript analysis could not run here: the native binding is missing. Everything else on this page is unaffected.",
    });
  });

  it("shows only a calm note when no file could be read", () => {
    const state = stateOf({
      coverage: {
        files: 2,
        parsed: 0,
        declarationFiles: 0,
        skipped: { "syntax-error": 2 },
        parser: { name: "oxc-parser", version: "0.152.0" },
      },
    });

    expect(state).toMatchObject({
      kind: "unread",
      message:
        "No TypeScript or JavaScript file could be read, so there is nothing to analyze.",
    });
  });
});

describe("a JavaScript-only repository", () => {
  it("has no figure on escape hatches or strictness, which are about types", () => {
    const state = typeScriptState(deepDive, false);

    expect(state).toMatchObject({ kind: "ready", typed: false });
    expect(
      state.kind === "ready" && state.figures.map(({ label }) => label),
    ).toEqual(["Complex functions", "Import cycles", "Test cases"]);
  });
});

describe("hasTypeScriptFiles", () => {
  it("looks for TypeScript among the languages of the code stats", () => {
    expect(
      hasTypeScriptFiles([{ name: "JavaScript" }, { name: "TypeScript" }]),
    ).toBe(true);
    expect(hasTypeScriptFiles([{ name: "JavaScript" }, { name: "CSS" }])).toBe(
      false,
    );
  });
});

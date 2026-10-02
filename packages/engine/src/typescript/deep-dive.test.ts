import { describe, expect, it } from "vitest";

import { factsWith } from "../testing/file-facts.js";
import { typescriptAnalysis } from "./deep-dive.js";
import type { FactsResult } from "./facts-of-source.js";
import type { TypeScriptFacts } from "./gather-typescript.js";

const parsed: FactsResult = { kind: "parsed", facts: factsWith({}) };
const skipped = (reason: "too-deep" | "syntax-error"): FactsResult => ({
  kind: "skipped",
  reason,
});

/** What reading the repository's configs and manifests found, when there are none. */
const NOTHING_READ: Pick<TypeScriptFacts, "project" | "manifests"> = {
  project: { configs: [], typescript: { declared: null, major: null } },
  manifests: [],
};

const ready = { kind: "ready", name: "oxc-parser", version: "9.9.9" } as const;

describe("typescriptDeepDive", () => {
  it("counts parsed, declaration and skipped files, each skip reason once it occurred", () => {
    const facts: TypeScriptFacts = {
      status: ready,
      declarationFiles: ["types/a.d.ts"],
      ...NOTHING_READ,
      files: [
        { path: "a.ts", lines: 10, result: parsed },
        { path: "b.ts", lines: 10, result: parsed },
        { path: "c.ts", lines: 10, result: skipped("too-deep") },
        { path: "d.ts", lines: 10, result: skipped("too-deep") },
        { path: "e.ts", lines: 10, result: skipped("syntax-error") },
      ],
    };

    expect(typescriptAnalysis(facts).section.coverage).toStrictEqual({
      files: 6,
      parsed: 2,
      declarationFiles: 1,
      skipped: { "too-deep": 2, "syntax-error": 1 },
      parser: { name: "oxc-parser", version: "9.9.9" },
    });
  });

  it("reports an empty skipped record when everything parsed", () => {
    const section = typescriptAnalysis({
      status: ready,
      declarationFiles: [],
      ...NOTHING_READ,
      files: [{ path: "a.ts", lines: 10, result: parsed }],
    }).section;

    expect(section.coverage.skipped).toStrictEqual({});
    expect(section.coverage).not.toHaveProperty("unavailable");
  });
});

describe("typescriptDeepDive without a parser", () => {
  it("names why the parser is unavailable and has no version for it", () => {
    const unavailable = {
      kind: "unavailable",
      name: "oxc-parser",
      reason: "Cannot find native binding",
    } as const;
    const section = typescriptAnalysis({
      status: unavailable,
      declarationFiles: ["a.d.ts"],
      ...NOTHING_READ,
      files: [
        {
          path: "a.ts",
          lines: 10,
          result: { kind: "skipped", reason: "parser-unavailable" },
        },
      ],
    }).section;

    expect(section.coverage).toStrictEqual({
      files: 2,
      parsed: 0,
      declarationFiles: 1,

      skipped: { "parser-unavailable": 1 },
      parser: { name: "oxc-parser", version: null },
      unavailable: "Cannot find native binding",
    });
  });
});

describe("typescriptAnalysis blocks", () => {
  it("has no block when no file was parsed", () => {
    const { section } = typescriptAnalysis({
      status: ready,
      declarationFiles: [],
      ...NOTHING_READ,
      files: [{ path: "a.ts", lines: 10, result: skipped("syntax-error") }],
    });

    expect(section).not.toHaveProperty("typeSafety");
  });

  it("figures a territory from the parsed files at its paths only", () => {
    const loud: FactsResult = {
      kind: "parsed",
      facts: factsWith({ typeSafety: { nonNull: 3 } }),
    };
    const { forPaths } = typescriptAnalysis({
      status: ready,
      declarationFiles: [],
      ...NOTHING_READ,
      files: [
        { path: "api/a.ts", lines: 300, result: loud },
        { path: "api/b.ts", lines: 100, result: parsed },
        { path: "api/c.ts", lines: 50, result: skipped("syntax-error") },
        { path: "ui/d.ts", lines: 80, result: parsed },
      ],
    });

    expect(
      forPaths(["api/a.ts", "api/b.ts", "api/c.ts", "README.md"]),
    ).toStrictEqual({
      files: 2,
      codeLines: 400,
      escapesPer1000: 7.5,
    });
    expect(forPaths(["README.md", "api/c.ts"])).toBeUndefined();
  });
});

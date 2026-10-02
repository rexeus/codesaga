import { describe, expect, it } from "vitest";

import { typescriptDeepDive } from "./deep-dive.js";
import type { FactsResult } from "./facts-of-source.js";
import type { TypeScriptFacts } from "./gather-typescript.js";

const parsed: FactsResult = {
  kind: "parsed",
  facts: { version: 1, nodes: 5 },
};
const skipped = (reason: "too-deep" | "syntax-error"): FactsResult => ({
  kind: "skipped",
  reason,
});

const ready = { kind: "ready", name: "oxc-parser", version: "9.9.9" } as const;

describe("typescriptDeepDive", () => {
  it("counts parsed, declaration and skipped files, each skip reason once it occurred", () => {
    const facts: TypeScriptFacts = {
      status: ready,
      declarationFiles: ["types/a.d.ts"],
      files: [
        { path: "a.ts", result: parsed },
        { path: "b.ts", result: parsed },
        { path: "c.ts", result: skipped("too-deep") },
        { path: "d.ts", result: skipped("too-deep") },
        { path: "e.ts", result: skipped("syntax-error") },
      ],
    };

    expect(typescriptDeepDive(facts)).toStrictEqual({
      coverage: {
        files: 6,
        parsed: 2,
        declarationFiles: 1,
        skipped: { "too-deep": 2, "syntax-error": 1 },
        parser: { name: "oxc-parser", version: "9.9.9" },
      },
    });
  });

  it("reports an empty skipped record when everything parsed", () => {
    const section = typescriptDeepDive({
      status: ready,
      declarationFiles: [],
      files: [{ path: "a.ts", result: parsed }],
    });

    expect(section.coverage.skipped).toStrictEqual({});
    expect(section.coverage).not.toHaveProperty("unavailable");
  });

  it("names why the parser is unavailable and has no version for it", () => {
    const unavailable = {
      kind: "unavailable",
      name: "oxc-parser",
      reason: "Cannot find native binding",
    } as const;
    const section = typescriptDeepDive({
      status: unavailable,
      declarationFiles: ["a.d.ts"],
      files: [
        {
          path: "a.ts",
          result: { kind: "skipped", reason: "parser-unavailable" },
        },
      ],
    });

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

import { describe, expect, it } from "vitest";

import { oxcParse } from "../testing/oxc-parser.js";
import { factsOfSource } from "./facts-of-source.js";
import type { ParseSource } from "./facts-of-source.js";

const judge = (path: string, text: string, parse: ParseSource = oxcParse) =>
  factsOfSource(parse, { path, text });

const neverCalled: ParseSource = () => {
  throw new Error("the guard should have stopped this source");
};

const failing: ParseSource = () => {
  throw new Error("native binding exploded");
};

describe("factsOfSource parsed files", () => {
  it("counts the syntax tree nodes of a parsed file", () => {
    // Program, VariableDeclaration, VariableDeclarator, Identifier, Literal
    expect(judge("a.ts", "const a = 1;\n")).toStrictEqual({
      kind: "parsed",
      facts: { version: 1, nodes: 5 },
    });
  });

  it("parses an empty file and a file of comments", () => {
    expect(judge("a.ts", "").kind).toBe("parsed");
    expect(judge("a.ts", "// nothing here\n").kind).toBe("parsed");
  });

  it("parses JSX in a .js file", () => {
    expect(judge("a.js", "export const a = <div>{1}</div>;\n").kind).toBe(
      "parsed",
    );
  });

  it("parses a top-level return in a CommonJS file", () => {
    expect(judge("a.cjs", "return 1;\n").kind).toBe("parsed");
    expect(judge("a.cts", "return 1;\n").kind).toBe("parsed");
  });

  it("keeps the facts of a file with an error the parser recovered from", () => {
    const source = "await 1;\nfunction f() { yield 2; }\nexport const a = 1;\n";

    expect(judge("a.js", source).kind).toBe("parsed");
  });

  it("hands the parser the options of the file's extension", () => {
    const seen: Array<unknown> = [];
    const spy: ParseSource = (path, text, options) => {
      seen.push([path, options]);
      return oxcParse(path, text, options);
    };

    judge("lib/a.mjs", "export const a = 1;\n", spy);

    expect(seen).toStrictEqual([
      ["lib/a.mjs", { lang: "jsx", sourceType: "module" }],
    ]);
  });
});

describe("factsOfSource skipped files", () => {
  it("skips a file the parser cannot recover anything from as a syntax error", () => {
    const conflict =
      "<<<<<<< HEAD\nconst a = 1;\n=======\nconst a = 2;\n>>>>>>> x\n";

    expect(judge("a.ts", "const a = ;\n")).toStrictEqual({
      kind: "skipped",
      reason: "syntax-error",
    });
    expect(judge("a.ts", conflict)).toStrictEqual({
      kind: "skipped",
      reason: "syntax-error",
    });
  });

  it("never parses a source that fails a guard", () => {
    expect(judge("a.js", "x".repeat(10_001), neverCalled)).toStrictEqual({
      kind: "skipped",
      reason: "minified",
    });
    expect(judge("a.ts", "a;\n".repeat(400_000), neverCalled)).toStrictEqual({
      kind: "skipped",
      reason: "too-large",
    });
  });

  it("skips a tree nested deeper than the stack allows as too deep", () => {
    const chain = `x = 1\n${"+1\n".repeat(30_000)}`;

    expect(judge("a.ts", chain)).toStrictEqual({
      kind: "skipped",
      reason: "too-deep",
    });
  });

  it("skips a source the parser fails on as a parser error", () => {
    expect(judge("a.ts", "const a = 1;\n", failing)).toStrictEqual({
      kind: "skipped",
      reason: "parser-error",
    });
  });
});

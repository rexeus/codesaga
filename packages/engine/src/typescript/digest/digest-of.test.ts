import { describe, expect, it } from "vitest";

import { oxcParse } from "../../testing/oxc-parser.js";
import { digestOfSource, factsOfSource } from "../facts-of-source.js";
import { isFileDigest } from "./file-digest.js";
import type { FileDigest } from "./file-digest.js";

const digestOf = (path: string, text: string): FileDigest => {
  const result = digestOfSource(oxcParse, { path, text });
  if (result.kind !== "parsed") {
    throw new Error(`not parsed: ${result.reason}`);
  }
  return result.facts;
};

const SOURCE = `import { a } from "./a.js";

// @ts-ignore
export const x: any = a as any;
export function hard(input: number): number {
  if (input > 1) {
    if (input > 2) {
      for (const n of [1, 2]) {
        if (n > 1 && input > 3) {
          return n;
        }
      }
    }
  }
  return 0;
}
const arrow = () => 1;
class Box {}
it("works", () => {});
it.only("focused", () => {});
`;

describe("fileDigestOf", () => {
  it("counts what the history reads: lines, escapes, functions, modules, declarations and tests", () => {
    const digest = digestOf("src/a.test.ts", SOURCE);

    expect(digest).toMatchObject({
      lines: 19,
      any: 2,
      escapes: 3,
      suppressions: 1,
      esm: true,
      commonjs: false,
      testCases: 2,
      focusedTests: 1,
      declarations: 3,
      exportedFunctions: 1,
    });
    expect(digest.functions).toBe(4);
    expect(digest.notable).toStrictEqual([["hard", 11]]);
  });

  it("agrees with the full facts of the same file on every count they share", () => {
    const facts = factsOfSource(oxcParse, { path: "src/a.ts", text: SOURCE });
    const digest = digestOf("src/a.ts", SOURCE);

    expect(facts.kind).toBe("parsed");
    if (facts.kind === "parsed") {
      expect([digest.any, digest.functions, digest.testCases]).toStrictEqual([
        facts.facts.typeSafety.any,
        facts.facts.functions.count,
        facts.facts.tests.cases,
      ]);
      expect(digest.notable.map(([name]) => name)).toStrictEqual(
        facts.facts.functions.notable.map(({ name }) => name),
      );
    }
  });
});

describe("fileDigestOf exports", () => {
  it("counts exported functions where they are declared, and not an interface, a private function or an export list", () => {
    const digest = digestOf(
      "src/m.ts",
      [
        "function hidden() {}",
        "export interface Shape { size: number }",
        "export function shown() {}",
        "export const arrow = () => 1;",
        "export const value = 1;",
        "function listed() {}",
        "export { listed };",
        "export default function () {}",
      ].join("\n"),
    );

    expect(digest.exportedFunctions).toBe(3);
    expect(digest.declarations).toBe(5);
  });

  it("counts a line that holds only whitespace, a carriage return included, as blank", () => {
    const digest = digestOf(
      "a.ts",
      "const a = 1;\r\n\r\n  \t \r\nconst b = 2;\r\n",
    );

    expect(digest.lines).toBe(2);
  });

  it("is a digest by its own guard, and a digest of another version is not", () => {
    const digest = digestOf("a.ts", "export const a = 1;\n");

    expect(isFileDigest(digest)).toBe(true);
    expect(isFileDigest({ ...digest, version: 0 })).toBe(false);
    expect(isFileDigest({ ...digest, lines: "3" })).toBe(false);
    expect(isFileDigest(null)).toBe(false);
  });
});

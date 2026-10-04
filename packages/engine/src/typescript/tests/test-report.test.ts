import { describe, expect, it } from "vitest";

import type { Ecosystem } from "../../report/typescript-ecosystem.js";
import { factsWith } from "../../testing/file-facts.js";
import type { ParsedFile } from "../parsed-file.js";
import type { TestFacts } from "./test-facts.js";
import { testsOf } from "./test-report.js";

const file = (path: string, tests: Partial<TestFacts>): ParsedFile => ({
  path,
  lines: 100,
  facts: factsWith({ tests }),
});

const ecosystem: Ecosystem = {
  tools: [
    { name: "React", category: "framework", files: 9, declaredIn: 1 },
    { name: "Vitest", category: "test", files: 5, declaredIn: 1 },
    { name: "Playwright", category: "test", files: 0, declaredIn: 1 },
  ],
  packages: [],
  undeclared: 0,
  nodeBuiltins: [],
  dependencies: { manifests: 1, runtime: 0, dev: 0 },
  hooks: { calls: 0, files: 0 },
};

describe("testsOf", () => {
  it("adds the counts of the test files only and names the detected frameworks", () => {
    const tests = testsOf(
      [
        file("src/a.test.ts", {
          cases: 10,
          parameterized: 2,
          skipped: 1,
          todo: 1,
          assertions: [1, 4, 3, 1],
          snapshots: 2,
          typeTests: 1,
        }),
        file("test/b.ts", { cases: 5, assertions: [0, 5, 0, 0], snapshots: 1 }),
        file("src/prod.ts", {
          cases: 99,
          focused: 7,
          assertions: [9, 9, 9, 9],
        }),
      ],
      ecosystem,
    );

    expect(tests).toStrictEqual({
      files: 2,
      frameworks: ["Vitest", "Playwright"],
      cases: 15,
      parameterized: 2,
      skipped: 1,
      focused: 0,
      todo: 1,
      focusedFiles: [],
      focusedFileCount: 0,
      assertions: [1, 9, 3, 1],
      snapshots: 3,
      typeTests: 1,
    });
  });
});

describe("testsOf focused files", () => {
  it("lists the files with a focused case in path order, five at most", () => {
    const focused = ["f", "e", "d", "c", "b", "a"].map((name) =>
      file(`src/${name}.test.ts`, { focused: 1 }),
    );

    const tests = testsOf(
      [...focused, file("src/ok.test.ts", { cases: 3 })],
      ecosystem,
    );

    expect(tests.focused).toBe(6);
    expect(tests.focusedFileCount).toBe(6);
    expect(tests.focusedFiles).toStrictEqual([
      "src/a.test.ts",
      "src/b.test.ts",
      "src/c.test.ts",
      "src/d.test.ts",
      "src/e.test.ts",
    ]);
  });

  it("reports no test file as zeros", () => {
    expect(testsOf([], ecosystem)).toMatchObject({
      files: 0,
      cases: 0,
      assertions: [0, 0, 0, 0],
    });
  });
});

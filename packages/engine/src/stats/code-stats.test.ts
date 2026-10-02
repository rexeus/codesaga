import { describe, expect, it } from "vitest";

import { inventoryFile, linesOf } from "../testing/inventory-file.js";
import { codeStats } from "./code-stats.js";

/** Tab-indented lines at the given levels: complexity is their sum over their count. */
const withLevels = (...levels: ReadonlyArray<number>): string =>
  levels.map((level) => `${"\t".repeat(level)}x\n`).join("");

const none = new Map<string, number>();

const A = inventoryFile(
  "src/a.ts",
  "function f() {\n  if (x) {\n    y();\n  }\n}\n",
);
const B_TEST = inventoryFile(
  "src/b.test.ts",
  '// check it\nit("a", () => {\n\texpect(1);\n});\n',
);
const C = inventoryFile("lib/c.py", "# c\ndef c():\n    return 1\n");
const EMPTY = inventoryFile("lib/empty.ts", "");

const revisions = new Map([
  ["src/a.ts", 3],
  ["src/b.test.ts", 1],
  ["lib/c.py", 12],
]);

const smallSet = codeStats([A, B_TEST, C, EMPTY], revisions);

describe("codeStats of a small set", () => {
  it("counts files and code lines", () => {
    expect(smallSet.files).toBe(4);
    expect(smallSet.codeLines).toBe(12);
  });

  it("measures file length without the empty file", () => {
    expect(smallSet.fileLength).toStrictEqual({
      min: 3,
      median: 4,
      max: 5,
      histogram: [
        { label: "1–50", files: 3 },
        { label: "51–100", files: 0 },
        { label: "101–200", files: 0 },
        { label: "201–400", files: 0 },
        { label: "401–800", files: 0 },
        { label: "800+", files: 0 },
      ],
      longestFile: "src/a.ts",
    });
  });

  it("lists languages by lines, then name, and counts tests by path", () => {
    expect(smallSet.languages).toStrictEqual([
      { name: "TypeScript", files: 3, lines: 9 },
      { name: "Python", files: 1, lines: 3 },
    ]);
    expect(smallSet.tests).toStrictEqual({ files: 1, lines: 4 });
  });

  it("counts revisions, giving a file without a known commit one", () => {
    // sorted by path: c.py 12, empty.ts 1, a.ts 3, b.test.ts 1;
    // median (1 + 3) / 2, p90 between rank 2 (3) and rank 3 (12): 3 + 9 * 0.7
    expect(smallSet.churn).toStrictEqual({
      median: 2,
      p90: 9.3,
      revisions: 17,
      revisionLines: 55,
      histogram: [
        { label: "1", files: 2 },
        { label: "2", files: 0 },
        { label: "3–4", files: 1 },
        { label: "5–9", files: 0 },
        { label: "10–19", files: 1 },
        { label: "20+", files: 0 },
      ],
      mostChanged: [
        { path: "lib/c.py", revisions: 12 },
        { path: "src/a.ts", revisions: 3 },
        { path: "lib/empty.ts", revisions: 1 },
        { path: "src/b.test.ts", revisions: 1 },
      ],
    });
  });
});

describe("codeStats complexity and style of a small set", () => {
  it("measures indentation levels per line", () => {
    // levels 4 + 1 + 1 over 12 lines; per file 0.8, 0.25 and 0.3333
    expect(smallSet.complexity).toStrictEqual({
      perLine: 0.5,
      medianFile: 0.3333,
      deepestLevel: 2,
      histogram: [
        { label: "<0.25", files: 0 },
        { label: "0.25–0.5", files: 2 },
        { label: "0.5–1", files: 1 },
        { label: "1–1.5", files: 0 },
        { label: "1.5–2", files: 0 },
        { label: "2+", files: 0 },
      ],
      deepestFile: { path: "src/a.ts", perLine: 0.8 },
    });
  });

  it("measures indentation, line length and comments", () => {
    // 3 + 1 space-indented and 1 tab-indented lines; widths vote 2 (3 lines) against 4 (1 line);
    // line lengths 1 3 3 3 8 8 10 11 11 12 14 15: median (8 + 10) / 2, p90 12 + (14 - 12) * 0.9
    expect(smallSet.style).toStrictEqual({
      indent: { spacesShare: 0.8, tabsShare: 0.2, width: 2 },
      lineLength: { median: 9, p90: 13.8 },
      commentLines: { lines: 2, share: 0.1667 },
    });
  });

  it("does not depend on the order of the files", () => {
    expect(codeStats([EMPTY, C, B_TEST, A], revisions)).toStrictEqual(smallSet);
  });
});

describe("codeStats of no files and of one", () => {
  it("is all zeros and no named files for an empty set", () => {
    const stats = codeStats([], none);

    expect(stats).toMatchObject({
      files: 0,
      codeLines: 0,
      languages: [],
      tests: { files: 0, lines: 0 },
      fileLength: { min: 0, median: 0, max: 0, longestFile: null },
      churn: { median: 0, p90: 0, revisions: 0, mostChanged: [] },
      complexity: { perLine: 0, medianFile: 0, deepestFile: null },
      style: {
        indent: { spacesShare: 0, tabsShare: 0, width: 0 },
        lineLength: { median: 0, p90: 0 },
        commentLines: { lines: 0, share: 0 },
      },
    });
    expect(stats.fileLength.histogram.every(({ files }) => files === 0)).toBe(
      true,
    );
  });

  it("reports a single file as its own median, maximum and deepest file", () => {
    const stats = codeStats([A], new Map([["src/a.ts", 7]]));

    expect(stats.fileLength).toMatchObject({ min: 5, median: 5, max: 5 });
    expect(stats.churn).toMatchObject({ median: 7, p90: 7, revisions: 7 });
    expect(stats.complexity).toMatchObject({
      medianFile: 0.8,
      deepestFile: { path: "src/a.ts", perLine: 0.8 },
    });
  });

  it("counts a file without code lines but leaves it out of the distributions", () => {
    const stats = codeStats([EMPTY], none);

    expect(stats.files).toBe(1);
    expect(stats.fileLength.longestFile).toBeNull();
    expect(stats.complexity.deepestFile).toBeNull();
  });
});

describe("codeStats indentation style", () => {
  it("reads a tab-indented set as all tabs without a space width", () => {
    const stats = codeStats(
      [inventoryFile("a.ts", withLevels(0, 1, 2, 1))],
      none,
    );

    expect(stats.style.indent).toStrictEqual({
      spacesShare: 0,
      tabsShare: 1,
      width: 0,
    });
  });

  it("reports no shares for code without indentation", () => {
    expect(
      codeStats([inventoryFile("a.ts", "a\nb\n")], none).style.indent,
    ).toStrictEqual({ spacesShare: 0, tabsShare: 0, width: 0 });
  });

  it("lets the smaller width win a tie between files", () => {
    const four = inventoryFile("four.ts", "a\n    b\n");
    const two = inventoryFile("two.ts", "a\n  b\n");

    expect(codeStats([four, two], none).style.indent.width).toBe(2);
  });
});

describe("codeStats most changed files", () => {
  it("lists the five files with the most revisions, ties in path order", () => {
    const counts = [3, 9, 9, 1, 5, 9, 2];
    const stats = codeStats(
      counts.map((_, index) => inventoryFile(`f${index + 1}.ts`)),
      new Map(counts.map((count, index) => [`f${index + 1}.ts`, count])),
    );

    expect(stats.churn.mostChanged).toStrictEqual([
      { path: "f2.ts", revisions: 9 },
      { path: "f3.ts", revisions: 9 },
      { path: "f6.ts", revisions: 9 },
      { path: "f5.ts", revisions: 5 },
      { path: "f1.ts", revisions: 3 },
    ]);
  });
});

describe("codeStats buckets", () => {
  it("puts lengths of 50, 51, 100 ... 801 lines on either side of each file length edge", () => {
    const lengths = [50, 51, 100, 101, 200, 201, 400, 401, 800, 801];
    const stats = codeStats(
      lengths.map((length) => inventoryFile(`f${length}.ts`, linesOf(length))),
      none,
    );

    expect(stats.fileLength.histogram.map(({ files }) => files)).toStrictEqual([
      1, 2, 2, 2, 2, 1,
    ]);
  });

  it("puts revisions of 1, 2, 3, 4, 5, 9, 10, 19 and 20 on either side of each churn edge", () => {
    const counts = [1, 2, 3, 4, 5, 9, 10, 19, 20];
    const stats = codeStats(
      counts.map((count) => inventoryFile(`f${count}.ts`)),
      new Map(counts.map((count) => [`f${count}.ts`, count])),
    );

    expect(stats.churn.histogram.map(({ files }) => files)).toStrictEqual([
      1, 1, 2, 2, 2, 1,
    ]);
  });

  it("puts levels per line of 0.2, 0.25, 0.5, 1, 1.5 and 2 into the next bucket from each edge", () => {
    // four lines each, except 0.2 which is one level over five lines
    const files = [
      ["a", withLevels(1, 0, 0, 0, 0)],
      ["b", withLevels(1, 0, 0, 0)],
      ["c", withLevels(1, 1, 0, 0)],
      ["d", withLevels(1, 1, 1, 1)],
      ["e", withLevels(2, 2, 1, 1)],
      ["f", withLevels(2, 2, 2, 2)],
    ] as const;
    const stats = codeStats(
      files.map(([name, text]) => inventoryFile(`${name}.ts`, text)),
      none,
    );

    expect(stats.complexity.histogram.map(({ files: n }) => n)).toStrictEqual([
      1, 1, 1, 1, 1, 1,
    ]);
  });
});

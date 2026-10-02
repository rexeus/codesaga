import { describe, expect, it } from "vitest";

import { inventoryFile, linesOf } from "../testing/inventory-file.js";
import type { InventoryFile } from "../universe/inventory.js";
import { codeStats } from "./code-stats.js";
import { withRepositoryDetail } from "./repository-detail.js";

/** Tab-indented lines at the given levels: complexity is their sum over their count. */
const withLevels = (...levels: ReadonlyArray<number>): string =>
  levels.map((level) => `${"\t".repeat(level)}x\n`).join("");

const none = new Map<string, number>();

const detailed = (
  files: ReadonlyArray<InventoryFile>,
  revisions: ReadonlyMap<string, number> = none,
) => withRepositoryDetail(codeStats(files, revisions), files, revisions);

describe("withRepositoryDetail histograms", () => {
  it("puts lengths of 50, 51, 100 ... 800 and 801 lines on either side of each file length edge, 800 in 401-800", () => {
    const lengths = [50, 51, 100, 101, 200, 201, 400, 401, 800, 801];
    const stats = detailed(
      lengths.map((length) => inventoryFile(`f${length}.ts`, linesOf(length))),
    );

    expect(stats.fileLength.histogram).toStrictEqual([1, 2, 2, 2, 2, 1]);
  });

  it("puts revisions of 1, 2, 3, 4, 5, 9, 10, 19 and 20 on either side of each churn edge", () => {
    const counts = [1, 2, 3, 4, 5, 9, 10, 19, 20];
    const stats = detailed(
      counts.map((count) => inventoryFile(`f${count}.ts`)),
      new Map(counts.map((count) => [`f${count}.ts`, count])),
    );

    expect(stats.churn.histogram).toStrictEqual([1, 1, 2, 2, 2, 1]);
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
    const stats = detailed(
      files.map(([name, text]) => inventoryFile(`${name}.ts`, text)),
    );

    expect(stats.complexity.histogram).toStrictEqual([1, 1, 1, 1, 1, 1]);
  });

  it("counts every bucket, empty ones too, and leaves files without a code line out", () => {
    const stats = detailed([
      inventoryFile("a.ts", linesOf(3)),
      inventoryFile("empty.ts", ""),
    ]);

    expect(stats.fileLength.histogram).toStrictEqual([1, 0, 0, 0, 0, 0]);
    expect(stats.complexity.histogram).toStrictEqual([1, 0, 0, 0, 0, 0]);
  });
});

describe("withRepositoryDetail most changed files", () => {
  it("lists the five files with the most revisions, ties in path order", () => {
    const counts = [3, 9, 9, 1, 5, 9, 2];
    const stats = detailed(
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

import { describe, expect, it } from "vitest";

import { factsWith } from "../../testing/file-facts.js";
import type { ParsedFile } from "../parsed-file.js";
import type { FunctionFacts } from "./function-facts.js";
import {
  functionsReportOf,
  productionFunctionFigures,
} from "./function-report.js";

const file = (
  path: string,
  lines: number,
  functions: Partial<FunctionFacts>,
): ParsedFile => ({ path, lines, facts: factsWith({ functions }) });

const testFile = file("src/c.test.ts", 100, {
  count: 1,
  complexity: [1, 0, 0, 0, 0],
  lengths: [1, 0, 0, 0],
  scores: [[0, 1]],
});

const files = [
  file("src/a.ts", 1000, {
    count: 4,
    complexity: [3, 0, 0, 1, 0],
    lengths: [3, 1, 0, 0],
    scores: [
      [0, 2],
      [2, 1],
      [16, 1],
    ],
    hardLines: 40,
    longParameterLists: 1,
    maxDepth: 4,
    notable: [{ name: "big", line: 10, complexity: 16, lines: 40 }],
  }),
  file("src/b.ts", 500, {
    count: 2,
    complexity: [1, 1, 0, 0, 0],
    lengths: [1, 1, 0, 0],
    scores: [
      [1, 1],
      [5, 1],
    ],
    maxDepth: 2,
    notable: [{ name: "mid", line: 3, complexity: 5, lines: 20 }],
  }),
  testFile,
];

describe("functionsReportOf", () => {
  it("adds the bands of production code and tests apart, each with its own denominators", () => {
    const { production, tests } = functionsReportOf(files);

    expect(production).toMatchObject({
      files: 2,
      codeLines: 1500,
      functions: 6,
      lengths: [4, 2, 0, 0],
      longParameterLists: 1,
      maxDepth: 4,
    });
    expect(production.complexity.bands).toStrictEqual([4, 1, 0, 1, 0]);
    expect(tests).toMatchObject({ files: 1, codeLines: 100, functions: 1 });
    expect(tests.complexity.bands).toStrictEqual([1, 0, 0, 0, 0]);
  });

  it("reads the percentiles from the tally of every score, interpolating between ranks", () => {
    const { production } = functionsReportOf(files);

    expect(production.complexity).toMatchObject({
      p50: 1.5,
      p90: 10.5,
      max: 16,
    });
  });

  it("reports the share of functions and of code lines at or above 15", () => {
    const { production, tests } = functionsReportOf(files);

    expect(production.over15).toStrictEqual({
      functions: 1,
      share: 0.1667,
      lines: 40,
      lineShare: 0.0267,
    });
    expect(tests.over15).toStrictEqual({
      functions: 0,
      share: 0,
      lines: 0,
      lineShare: 0,
    });
  });
});

describe("functionsReportOf lists", () => {
  it("lists the hardest functions with their path, hardest first", () => {
    const { production, tests } = functionsReportOf(files);

    expect(production.top).toStrictEqual([
      { name: "big", path: "src/a.ts", line: 10, complexity: 16, lines: 40 },
      { name: "mid", path: "src/b.ts", line: 3, complexity: 5, lines: 20 },
    ]);
    expect(tests.top).toStrictEqual([]);
  });

  it("lists five functions at most, breaking ties by path and line", () => {
    const many = file("src/many.ts", 100, {
      notable: Array.from({ length: 4 }, (_, index) => ({
        name: `f${index}`,
        line: 10 - index,
        complexity: 7,
        lines: 5,
      })),
    });
    const other = file("src/a-first.ts", 100, {
      notable: [
        { name: "g", line: 90, complexity: 7, lines: 5 },
        { name: "h", line: 1, complexity: 7, lines: 5 },
      ],
    });

    const { production } = functionsReportOf([many, other]);

    expect(production.top.map(({ name }) => name)).toStrictEqual([
      "h",
      "g",
      "f3",
      "f2",
      "f1",
    ]);
  });

  it("reports an empty set as zeros", () => {
    const { tests } = functionsReportOf([]);

    expect(tests).toStrictEqual({
      files: 0,
      codeLines: 0,
      functions: 0,
      complexity: { bands: [0, 0, 0, 0, 0], p50: 0, p90: 0, max: 0 },
      over15: { functions: 0, share: 0, lines: 0, lineShare: 0 },
      top: [],
      lengths: [0, 0, 0, 0],
      longParameterLists: 0,
      maxDepth: 0,
    });
  });
});

describe("productionFunctionFigures", () => {
  it("gives the share at 15 or more and the highest score of the production functions only", () => {
    expect(productionFunctionFigures(files)).toStrictEqual({
      over15Share: 0.1667,
      maxComplexity: 16,
    });
  });

  it("is undefined when the files hold no production function", () => {
    expect(productionFunctionFigures([testFile])).toBeUndefined();
    expect(productionFunctionFigures([])).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import { storyFacts } from "../testing/story-facts.js";
import {
  deepDiveWith,
  functionsBlock,
  importsBlock,
  testsBlock,
} from "../testing/typescript-blocks.js";
import type { functionsPart } from "../testing/typescript-blocks.js";
import { stories } from "./stories.js";

const kindsOf = (facts: Parameters<typeof storyFacts>[0]) =>
  stories(storyFacts(facts)).map(({ kind }) => kind);

const focused = (
  focusedFiles: ReadonlyArray<string>,
  count = 1,
  focusedFileCount = focusedFiles.length,
) =>
  deepDiveWith({
    tests: testsBlock({ focused: count, focusedFiles, focusedFileCount }),
  });

const hardest = {
  name: "reconcileInvoices",
  path: "packages/api/src/billing/reconcile.ts",
  line: 88,
  complexity: 41,
  lines: 212,
};

const functionsFigures = (
  overrides: Partial<ReturnType<typeof functionsPart>> = {},
) =>
  functionsBlock({
    functions: 1840,
    top: [hardest],
    over15: { functions: 47, share: 0.0255, lines: 3210, lineShare: 0.0836 },
    ...overrides,
  });

const functionsOf = (
  overrides: Partial<ReturnType<typeof functionsPart>> = {},
) => deepDiveWith({ functions: functionsFigures(overrides) });

const TERRITORIES = ["core", "a", "b", "c", "d", "e"];

const importMap = (
  importers: ReadonlyArray<string>,
  territories = TERRITORIES,
) =>
  importsBlock(
    territories,
    importers.map((from) => [from, "core"] as const),
  );

const importing = (
  importers: ReadonlyArray<string>,
  territories = TERRITORIES,
) => deepDiveWith({ imports: importMap(importers, territories) });

describe("focused-test", () => {
  it("names the file with a committed focused test", () => {
    expect(
      stories(storyFacts({ typescript: focused(["billing/invoice.test.ts"]) })),
    ).toStrictEqual([
      {
        kind: "focused-test",
        title: "Focused test",
        detail:
          "1 focused test committed in billing/invoice.test.ts: the runner skips every other test while one stays.",
        value: 1,
        path: "billing/invoice.test.ts",
      },
    ]);
  });

  it("counts the other files and keeps a path with control characters as it is", () => {
    const [story] = stories(
      storyFacts({
        typescript: focused(
          ["a\u001B[31m.test.ts", "b.test.ts", "c.test.ts"],
          5,
        ),
      }),
    );

    expect(story?.detail).toBe(
      "5 focused tests committed in a\u001B[31m.test.ts and 2 other files: the runner skips every other test while one stays.",
    );
    expect(story?.path).toBe("a\u001B[31m.test.ts");
  });

  it("counts the files beyond the listed five", () => {
    const [story] = stories(
      storyFacts({
        typescript: focused(
          ["a.test.ts", "b.test.ts", "c.test.ts", "d.test.ts", "e.test.ts"],
          12,
          9,
        ),
      }),
    );

    expect(story?.detail).toBe(
      "12 focused tests committed in a.test.ts and 8 other files: the runner skips every other test while one stays.",
    );
  });

  it("is not there without a focused case", () => {
    expect(kindsOf({ typescript: focused([], 0) })).toStrictEqual([]);
  });
});

const complexCoreWith = (functions: number, complexity: number) =>
  kindsOf({
    typescript: functionsOf({
      functions,
      top: [{ ...hardest, complexity }],
    }),
  });

describe("complex-core", () => {
  it("names the hardest function and the share of the code in functions at 15 or more", () => {
    expect(stories(storyFacts({ typescript: functionsOf() }))).toStrictEqual([
      {
        kind: "complex-core",
        title: "Hard functions",
        detail:
          "The hardest function, reconcileInvoices in packages/api/src/billing/reconcile.ts, scores 41; the 47 of 1,840 functions at 15 or more hold 8% of the code.",
        value: 41,
        path: "packages/api/src/billing/reconcile.ts",
      },
    ]);
  });

  it("says an anonymous function in its file and line, and keeps a function bound to a name", () => {
    const [story] = stories(
      storyFacts({
        typescript: functionsOf({
          top: [{ ...hardest, name: "(anonymous)", line: 17 }],
        }),
      }),
    );

    expect(story?.detail).toContain(
      "The hardest function, an anonymous function in packages/api/src/billing/reconcile.ts:17, scores 41;",
    );
    const [nested] = stories(
      storyFacts({
        typescript: functionsOf({
          top: [{ ...hardest, name: "make > (anonymous)" }],
        }),
      }),
    );
    expect(nested?.detail).toContain(
      "The hardest function, make > (anonymous) in packages/api",
    );
  });

  it("says under 1% for a share that rounds to none", () => {
    const [story] = stories(
      storyFacts({
        typescript: functionsOf({
          over15: { functions: 3, share: 0.0016, lines: 40, lineShare: 0.004 },
        }),
      }),
    );

    expect(story?.detail).toContain("hold under 1% of the code");
  });

  it("needs 100 functions and a hardest one of 25", () => {
    expect(complexCoreWith(100, 25)).toStrictEqual(["complex-core"]);
    expect(complexCoreWith(99, 25)).toStrictEqual([]);
    expect(complexCoreWith(100, 24)).toStrictEqual([]);
  });
});

describe("core-territory", () => {
  it("names a territory that at least 60% of the others import", () => {
    expect(
      stories(storyFacts({ typescript: importing(["a", "b", "c"]) })),
    ).toStrictEqual([
      {
        kind: "core-territory",
        title: "Core territory",
        detail: "core is imported by 3 of 5 other territories.",
        value: 3,
        path: "core",
      },
    ]);
  });

  it("is not there just below 60%, with fewer than 5 territories, or when only unnamed ones import", () => {
    expect(kindsOf({ typescript: importing(["a", "b"]) })).toStrictEqual([]);
    expect(
      kindsOf({
        typescript: importing(["a", "b", "c"], ["core", "a", "b", "c"]),
      }),
    ).toStrictEqual([]);
    const map = importsBlock(TERRITORIES, []);
    const other = deepDiveWith({
      imports: {
        ...map,
        territories: {
          ...map.territories,
          edges: ["a", "b", "c"].map((path) => ({
            from: { path, kind: "other" as const },
            to: { path: "core", kind: "package" as const },
            files: 1,
            typeOnlyFiles: 0,
          })),
        },
      },
    });
    expect(kindsOf({ typescript: other })).toStrictEqual([]);
  });
});

const edgesTo = (to: string) =>
  ["a", "b", "c"].map((from) => [from, to] as const);

describe("core-territory ties", () => {
  it("breaks a tie by code unit, so Zeta comes before alpha", () => {
    const territories = ["alpha", "Zeta", "a", "b", "c", "d"];
    const [story] = stories(
      storyFacts({
        typescript: deepDiveWith({
          imports: importsBlock(territories, [
            ...edgesTo("alpha"),
            ...edgesTo("Zeta"),
          ]),
        }),
      }),
    );

    expect(story?.path).toBe("Zeta");
  });
});

describe("core-territory naming", () => {
  it("calls the root territory the repository root", () => {
    const [story] = stories(
      storyFacts({
        typescript: deepDiveWith({
          imports: importsBlock(
            [".", "a", "b", "c", "d"],
            ["a", "b", "c", "d"].map((from) => [from, "."] as const),
          ),
        }),
      }),
    );

    expect(story?.detail).toBe(
      "The repository root is imported by 4 of 4 other territories.",
    );
  });
});

describe("TypeScript stories", () => {
  it("are absent without the deep dive", () => {
    expect(kindsOf({})).toStrictEqual([]);
  });

  it("keep at most two of the three in the list, the most notable first", () => {
    const typescript = deepDiveWith({
      tests: testsBlock({ focused: 1, focusedFiles: ["a.test.ts"] }),
      functions: functionsFigures(),
      imports: importMap(["a", "b", "c"]),
    });

    expect(kindsOf({ typescript })).toStrictEqual([
      "focused-test",
      "complex-core",
    ]);
  });
});

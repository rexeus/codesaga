import { describe, expect, it } from "vitest";

import { factsWith } from "../../testing/file-facts.js";
import type { ParsedFile } from "../parsed-file.js";
import { complexityAndChangeOf } from "./complexity-and-change.js";

/** A parsed file whose hardest function scores `hardest`; 0 means one trivial function. */
const file = (path: string, hardest: number): ParsedFile => ({
  path,
  lines: 100,
  facts: factsWith({ functions: { count: 1, scores: [[hardest, 1]] } }),
});

const revisionsOf = (counts: Record<string, number>) =>
  new Map(Object.entries(counts));

const ten = [20, 12, 4, 2, 1, 1, 1, 1, 0, 0].map((hardest, index) =>
  file(`src/f${index}.ts`, hardest),
);
const revisions = revisionsOf({
  "src/f0.ts": 30,
  "src/f1.ts": 25,
  "src/f2.ts": 3,
  "src/f3.ts": 1,
  "src/f4.ts": 2,
  "src/f5.ts": 2,
  "src/f6.ts": 1,
  "src/f7.ts": 1,
  "src/f8.ts": 1,
  "src/f9.ts": 1,
});

describe("complexityAndChangeOf", () => {
  it("shares the revisions that landed in files whose hardest function scores 15 or more", () => {
    const block = complexityAndChangeOf(ten, revisions);

    expect(block).toMatchObject({
      files: 10,
      revisions: 67,
      complexFiles: 1,
      complexRevisions: 30,
      complexRevisionShare: 0.4478,
    });
  });

  it("lists the files in the top decile of both hardness and revisions", () => {
    const block = complexityAndChangeOf(ten, revisions);

    expect(block?.hotspots).toStrictEqual([
      { path: "src/f0.ts", complexity: 20, revisions: 30 },
    ]);
  });
});

describe("complexityAndChangeOf edge cases", () => {
  it("counts a file with no revisions as unrevised, and leaves out tests and files without functions", () => {
    const block = complexityAndChangeOf(
      [
        ...ten,
        file("src/f0.test.ts", 30),
        {
          path: "src/empty.ts",
          lines: 5,
          facts: factsWith({}),
        },
      ],
      revisions,
    );

    expect(block?.files).toBe(10);
    expect(block?.revisions).toBe(67);
  });

  it("does not call a file revised once a hotspot", () => {
    const block = complexityAndChangeOf(
      [file("src/a.ts", 40), file("src/b.ts", 2)],
      revisionsOf({ "src/a.ts": 1, "src/b.ts": 1 }),
    );

    expect(block?.hotspots).toStrictEqual([]);
    expect(block?.complexFiles).toBe(1);
  });

  it("orders hotspots by revisions, then hardness, then path, five at most", () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      file(`src/h${index}.ts`, 30),
    );
    const block = complexityAndChangeOf(
      rows,
      revisionsOf(
        Object.fromEntries(
          rows.map(({ path }, index) => [path, 5 + (index % 2)]),
        ),
      ),
    );

    expect(block?.hotspots.map(({ path }) => path)).toStrictEqual([
      "src/h1.ts",
      "src/h11.ts",
      "src/h3.ts",
      "src/h5.ts",
      "src/h7.ts",
    ]);
  });

  it("is undefined when no production file has a function", () => {
    expect(complexityAndChangeOf([], new Map())).toBeUndefined();
    expect(
      complexityAndChangeOf([file("src/a.test.ts", 30)], revisionsOf({})),
    ).toBeUndefined();
  });
});

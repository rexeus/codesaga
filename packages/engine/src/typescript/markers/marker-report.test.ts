import { describe, expect, it } from "vitest";

import { factsWith } from "../../testing/file-facts.js";
import type { ParsedFile } from "../parsed-file.js";
import type { MarkerFacts } from "./marker-facts.js";
import { markersReportOf } from "./marker-report.js";

const file = (
  path: string,
  lines: number,
  markers: Partial<MarkerFacts>,
): ParsedFile => ({ path, lines, facts: factsWith({ markers }) });

describe("markersReportOf", () => {
  it("adds the markers of production files and shares the documented exports", () => {
    const report = markersReportOf([
      file("src/a.ts", 300, {
        todo: 4,
        fixme: 1,
        deprecated: 2,
        exportedDeclarations: 8,
        documentedExports: 2,
      }),
      file("src/b.ts", 200, {
        todo: 1,
        hack: 1,
        exportedDeclarations: 2,
        documentedExports: 1,
      }),
      file("src/a.test.ts", 100, { todo: 50, exportedDeclarations: 9 }),
    ]);

    expect(report).toStrictEqual({
      files: 2,
      lines: 500,
      todo: 5,
      fixme: 1,
      hack: 1,
      xxx: 0,
      deprecated: 2,
      exportedDeclarations: 10,
      documentedExports: 3,
      documentedShare: 0.3,
    });
  });

  it("reports a share of 0 where nothing is exported", () => {
    expect(markersReportOf([file("a.ts", 10, {})]).documentedShare).toBe(0);
  });
});

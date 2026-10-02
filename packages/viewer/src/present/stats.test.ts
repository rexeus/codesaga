import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { languageEntities } from "./languages.js";
import { changedFileRows, languageRows, styleRows, testRows } from "./stats.js";

const { stats, overview } = sampleReport();

describe("languageRows", () => {
  it("words the share of the lines, with under one percent for a sliver", () => {
    const rows = languageRows(
      [
        { name: "TypeScript", files: 9, lines: 9990 },
        { name: "Shell", files: 1, lines: 10 },
      ],
      languageEntities(overview.languages),
    );

    expect(rows.map(({ name, share }) => [name, share])).toEqual([
      ["TypeScript", "100%"],
      ["Shell", "<1%"],
    ]);
  });
});

describe("testRows", () => {
  it("sets the test files and lines against the rest", () => {
    const [files, lines] = testRows(stats);

    // 118 of 473 files, 14,820 of 60,942 lines
    expect(files).toMatchObject({
      label: "Files",
      tests: 118,
      others: 355,
      share: "25%",
    });
    expect(lines?.caption).toBe("14,820 test · 46,122 other code");
  });
});

describe("changedFileRows", () => {
  it("sizes each file against the most changed one", () => {
    const rows = changedFileRows(stats);

    expect(rows[0]).toMatchObject({
      name: "routes/checkout.ts",
      revisions: "214",
      fraction: 1,
    });
    // 97 of 214
    expect(rows[1]?.fraction).toBeCloseTo(0.4533, 4);
  });
});

describe("styleRows", () => {
  it("states the habits of the commits only when the report has them", () => {
    const { indent, lineLength, commentLines } = stats.style;
    const labels = (style: typeof stats.style) =>
      styleRows({ ...stats, style }).map(({ label }) => label);

    expect(labels(stats.style)).toEqual([
      "Indentation",
      "Line length",
      "Comment lines",
      "Conventional Commits",
      "Commit size",
    ]);
    expect(labels({ indent, lineLength, commentLines })).toEqual([
      "Indentation",
      "Line length",
      "Comment lines",
    ]);
  });

  it("words the indentation and the Conventional Commits share", () => {
    const [indent, , comments, conventional] = styleRows(stats);

    expect([indent?.lead, indent?.rest]).toEqual([
      "2 spaces",
      " · 96% spaces, 4% tabs",
    ]);
    expect(comments?.lead).toBe("8.0%");
    expect([conventional?.lead, conventional?.rest]).toEqual([
      "76%",
      " of commits · 1,713 of 2,246",
    ]);
  });
});

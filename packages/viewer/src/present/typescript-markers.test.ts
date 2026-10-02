import { describe, expect, it } from "vitest";

import { sampleBlock } from "../testing/reports.js";
import { markersTeaser, markersView } from "./typescript-markers.js";

const markers = sampleBlock("markers");

describe("markersView", () => {
  it("gives each marker its count and its rate per 1,000 lines", () => {
    // 64 of 38,400 lines is 1.667 per 1,000
    expect(markersView(markers).rows).toEqual([
      { label: "TODO", count: "64", rate: "1.7" },
      { label: "FIXME", count: "11", rate: "0.3" },
      { label: "HACK", count: "3", rate: "0.1" },
      { label: "XXX", count: "0", rate: "0.0" },
      { label: "@deprecated", count: "8", rate: "0.2" },
    ]);
  });

  it("words the documented exports", () => {
    expect(markersView(markers).documented).toBe(
      "54% of 1,120 exported declarations have a JSDoc block",
    );
    expect(markersView(markers).documentedShare).toBe(0.5393);
  });

  it("does not divide by no lines and no exports", () => {
    const view = markersView({
      ...markers,
      lines: 0,
      exportedDeclarations: 0,
      documentedExports: 0,
      documentedShare: 0,
    });

    expect(view.rows[0]?.rate).toBe("0.0");
    expect(view.documented).toBe("No exported declaration.");
  });
});

describe("markersTeaser", () => {
  it("adds the debt markers and names the documented share", () => {
    // 64 + 11 + 3 + 0
    expect(markersTeaser(markers)).toBe(
      "78 debt markers · 54% of exports documented",
    );
  });

  it("leaves out the share without exports", () => {
    expect(
      markersTeaser({
        ...markers,
        exportedDeclarations: 0,
        documentedExports: 0,
      }),
    ).toBe("78 debt markers");
  });
});

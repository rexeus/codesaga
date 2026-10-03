import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { histogramViews, medianBucket } from "./histograms.js";

const { stats } = sampleReport();

describe("histogramViews", () => {
  const [length, churn, complexity] = histogramViews(stats);

  it("labels the buckets and counts the files in each", () => {
    expect(length?.bins.map(({ label, files }) => [label, files])).toEqual([
      ["1–50", 113],
      ["51–100", 118],
      ["101–200", 120],
      ["201–400", 80],
      ["401–800", 33],
      ["> 800", 9],
    ]);
    expect(churn?.bins.map(({ label }) => label)).toEqual([
      "1",
      "2",
      "3–4",
      "5–9",
      "10–19",
      "20+",
    ]);
    expect(complexity?.bins.map(({ files }) => files)).toEqual([
      14, 33, 97, 141, 118, 70,
    ]);
  });

  it("counts files in every histogram and leaves the small bars unmarked", () => {
    expect(
      [length, churn, complexity].map((view) => [
        view?.noun,
        view?.annotateAll,
      ]),
    ).toEqual([
      ["files", false],
      ["files", false],
      ["files", false],
    ]);
  });

  it("sums each up in three figures and names the file that stands out", () => {
    expect(length?.facts).toEqual([
      { value: "5", label: "shortest" },
      { value: "96", label: "median" },
      { value: "1,204", label: "longest" },
    ]);
    expect(length?.named).toMatchObject({
      name: "routes/checkout.ts",
      note: "longest file",
    });
    expect(churn?.facts[2]).toEqual({
      value: "4.3k",
      label: "revisions in total",
    });
    expect(complexity?.named?.note).toBe("deepest on average, 4.1 per line");
  });
});

describe("histogramViews of a single file", () => {
  it("counts one file and one line in the singular", () => {
    const [length] = histogramViews({ ...stats, files: 1, codeLines: 1 });

    expect(length?.subtitle).toBe("1 file, 1 line. Files by length in lines");
  });
});

describe("medianBucket", () => {
  it("is the first bucket whose running total reaches half of the files", () => {
    expect(medianBucket([2, 10, 4])).toBe(1);
    expect(medianBucket([5, 5])).toBe(0);
  });

  it("is none for no files", () => {
    expect(medianBucket([0, 0, 0])).toBeNull();
  });
});

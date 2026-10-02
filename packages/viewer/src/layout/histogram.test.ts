import { describe, expect, it } from "vitest";

import { layoutHistogram } from "./histogram.js";

// 344 x 190 leaves a 300 x 150 plot (margins: 14 top, 26 bottom, 38 left, 6 right).
const SIZE = { width: 344, height: 190 };

const bins = [
  { label: "1–50", files: 2 },
  { label: "51–100", files: 10 },
  { label: "101–200", files: 4 },
];

describe("layoutHistogram", () => {
  const layout = layoutHistogram(bins, SIZE);

  it("gives each bucket an equal zone and a bar centred in it, capped at 54 px", () => {
    expect(layout.plot).toEqual({ width: 300, height: 150 });
    expect(layout.zones).toEqual([
      { x: 0, width: 100 },
      { x: 100, width: 100 },
      { x: 200, width: 100 },
    ]);
    expect(layout.bars.map(({ bar }) => [bar.x, bar.width])).toEqual([
      [23, 54],
      [123, 54],
      [223, 54],
    ]);
  });

  it("scales the bars against the tallest bucket, up from the baseline", () => {
    // the count axis runs 0 to 10 over 150 px
    expect(layout.bars.map(({ bar }) => [bar.y, bar.height])).toEqual([
      [120, 30],
      [0, 150],
      [90, 60],
    ]);
  });

  it("marks the bucket that holds the middle file and annotates it with the tallest", () => {
    // 2 + 10 = 12 of 16 files reaches half in the second bucket
    expect(layout.bars.map(({ median }) => median)).toEqual([
      false,
      true,
      false,
    ]);
    expect(layout.bars.map(({ annotated }) => annotated)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("labels the buckets under their bars", () => {
    expect(layout.labelTicks).toEqual([
      { position: 50, label: "1–50" },
      { position: 150, label: "51–100" },
      { position: 250, label: "101–200" },
    ]);
  });

  it("draws no bars and marks no median for a set without files", () => {
    const empty = layoutHistogram(
      bins.map(({ label }) => ({ label, files: 0 })),
      SIZE,
    );

    expect(
      empty.bars.every(
        ({ bar, median, annotated }) =>
          bar.height === 0 && !median && !annotated,
      ),
    ).toBe(true);
  });
});

describe("layoutHistogram of a skewed histogram", () => {
  it("annotates every bucket that has files when asked", () => {
    const skewed = layoutHistogram(
      [...bins, { label: "201+", files: 0 }],
      SIZE,
      true,
    );

    expect(skewed.bars.map(({ annotated }) => annotated)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });
});

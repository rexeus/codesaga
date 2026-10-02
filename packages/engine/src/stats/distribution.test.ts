import { describe, expect, it } from "vitest";

import { mergeIntegerTallies, percentile, tallyOf } from "./distribution.js";

describe("percentile", () => {
  it("takes the mean of the two middle values as the median of an even count", () => {
    expect(percentile(tallyOf([4, 1, 3, 2]), 0.5)).toBe(2.5);
  });

  it("takes the middle value as the median of an odd count", () => {
    expect(percentile(tallyOf([9, 1, 5]), 0.5)).toBe(5);
  });

  it("interpolates the 90th percentile between the two closest ranks", () => {
    // ten values: rank 9 * 0.9 = 8.1, between the 9th value 9 and the 10th value 10
    expect(
      percentile(tallyOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 0.9),
    ).toBeCloseTo(9.1, 10);
  });

  it("reads a repeated value as often as it occurs", () => {
    // 5, 5, 5, 100: the middle ranks both hold 5; rank 3 * 0.9 = 2.7 gives 5 + (100 - 5) * 0.7
    expect(percentile(tallyOf([5, 5, 5, 100]), 0.5)).toBe(5);
    expect(
      percentile(
        new Map([
          [5, 3],
          [100, 1],
        ]),
        0.9,
      ),
    ).toBeCloseTo(71.5, 10);
  });

  it("is the one value of a single value and 0 for no values", () => {
    expect(percentile(tallyOf([7]), 0.9)).toBe(7);
    expect(percentile(tallyOf([]), 0.5)).toBe(0);
  });
});

describe("mergeIntegerTallies", () => {
  it("adds the counts of equal values", () => {
    expect(
      mergeIntegerTallies([tallyOf([1, 2, 2]), tallyOf([2, 3])]),
    ).toStrictEqual(
      new Map([
        [1, 1],
        [2, 3],
        [3, 1],
      ]),
    );
  });
});

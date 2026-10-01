import { describe, expect, it } from "vitest";

import { languageShares } from "./languages.js";

const language = (name: string, loc: number) => ({ name, files: 1, loc });

const tenthsTotal = (percents: readonly number[]): number =>
  Math.round(percents.reduce((sum, percent) => sum + percent, 0) * 10);

describe("languageShares", () => {
  it("adds up to exactly 100 percent after rounding", () => {
    const shares = languageShares([
      language("TypeScript", 1),
      language("CSS", 1),
      language("SQL", 1),
    ]);

    // a third each is 33.3 and the leftover tenth goes to the first
    expect(shares.map(({ percent }) => percent)).toEqual([33.4, 33.3, 33.3]);
  });

  it("folds languages beyond the seventh into Other", () => {
    const shares = languageShares(
      Array.from({ length: 9 }, (_, index) =>
        language(`L${index}`, 10 - index),
      ),
    );

    expect(shares).toHaveLength(8);
    // L7 has 3 lines and L8 has 2
    expect(shares[7]).toMatchObject({ name: "Other", files: 2, loc: 5 });
    expect(shares[7]?.entity).toBe("slot-other");
    expect(tenthsTotal(shares.map(({ percent }) => percent))).toBe(1000);
  });

  it("colors the named languages by their order", () => {
    const shares = languageShares([language("Go", 5), language("Rust", 4)]);

    expect(shares.map(({ entity }) => entity)).toEqual(["slot-1", "slot-2"]);
  });

  it("gives no shares for no languages", () => {
    expect(languageShares([])).toEqual([]);
  });
});

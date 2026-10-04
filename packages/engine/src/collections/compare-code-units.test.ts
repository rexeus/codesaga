import { describe, expect, it } from "vitest";

import { compareCodeUnits } from "./compare-code-units.js";

describe("compareCodeUnits", () => {
  it("orders by code unit, capitals before lowercase letters and accents last, whatever the locale", () => {
    expect(
      ["a", "é", "B", "Z", "ab", "A"].toSorted(compareCodeUnits),
    ).toStrictEqual(["A", "B", "Z", "a", "ab", "é"]);
  });

  it("is 0 for equal strings", () => {
    expect(compareCodeUnits("src/a.ts", "src/a.ts")).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import { degreeOfExpertise } from "./doe.js";

describe("degreeOfExpertise", () => {
  it("applies the published model to a creator of a mid-sized file", () => {
    // 5.28223 + 0.23173·ln 121 + 0.36151 − 0.19421·ln 4 − 0.28761·ln 80
    const degree = degreeOfExpertise({
      adds: 120,
      firstAuthor: true,
      days: 3,
      size: 80,
    });

    expect(degree).toBeCloseTo(5.2255, 4);
  });

  it("treats an empty file as a one-line file", () => {
    const empty = degreeOfExpertise({
      adds: 1,
      firstAuthor: false,
      days: 0,
      size: 0,
    });
    const oneLine = degreeOfExpertise({
      adds: 1,
      firstAuthor: false,
      days: 0,
      size: 1,
    });

    expect(empty).toBe(oneLine);
  });
});

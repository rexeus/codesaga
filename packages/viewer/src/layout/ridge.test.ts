import { describe, expect, it } from "vitest";

import { layoutRidge } from "./ridge.js";

describe("layoutRidge", () => {
  it("starts and ends on the edges of the box with the peak week highest", () => {
    const ridge = layoutRidge([0, 10, 5], { width: 200, height: 100 });

    // the zero week sits 6 px above the floor; the peak week at 100 - 6 - 60
    expect(ridge?.edge.startsWith("M0,94")).toBe(true);
    expect(ridge?.edge).toContain("100,34");
    expect(ridge?.edge.endsWith("200,64")).toBe(true);
  });

  it("closes the area down to the floor", () => {
    const ridge = layoutRidge([1, 2], { width: 200, height: 100 });

    expect(ridge?.area.endsWith("Z")).toBe(true);
    expect(ridge?.area).toContain("L200,100");
  });

  it("has no ridge for fewer than two weeks", () => {
    expect(layoutRidge([3], { width: 200, height: 100 })).toBeNull();
  });
});

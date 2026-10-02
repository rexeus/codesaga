import { describe, expect, it } from "vitest";

import { churnTitle, commitsSubtitle, commitsTitle } from "./captions.js";

describe("chart captions", () => {
  it("names the unit of the bars the chart draws", () => {
    expect([commitsTitle("weeks"), churnTitle("months")]).toEqual([
      "Commits per week",
      "Lines changed per month",
    ]);
  });

  it("states the bars, the emphasised part and the rounded average", () => {
    expect(commitsSubtitle("weeks", 72, 11.4, true)).toBe(
      "72 weeks, last 12 highlighted. The dashed line is the average of 11 a week.",
    );
    expect(commitsSubtitle("months", 18, 40, false)).toBe(
      "18 months. The dashed line is the average of 40 a month.",
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  detailStatus,
  detailTicks,
  recommendationHeadline,
  recommendedDetailIndex,
  sliderFill,
  startDetail,
} from "./detail-slider.js";
import type { Detail, Territories } from "./territory-details.js";

const detail = (
  at: number,
  territories: Detail["territories"],
  totalTerritories = territories.length,
) => ({ detail: at, totalTerritories, territories });

describe("the detail slider", () => {
  const territories: Territories = {
    detail: 3,
    recommendedDetail: 2,
    reason: "detail 2: 11 territories for 7 active contributors",
    details: [
      detail(1, [], 5),
      detail(2, [], 11),
      detail(3, [], 16),
      detail(4, [], 1),
    ],
  };

  it("has a stop per detail, evenly spread, with the recommended one marked", () => {
    expect(
      detailTicks(territories).map(
        ({ label, count, position, recommended }) => [
          label,
          count,
          position,
          recommended,
        ],
      ),
    ).toEqual([
      ["Detail 1", "5 territories", 0, false],
      ["Detail 2", "11 territories", 1 / 3, true],
      ["Detail 3", "16 territories", 2 / 3, false],
      ["Detail 4", "1 territory", 1, false],
    ]);
  });

  it("starts at the report's detail and jumps to the recommended detail", () => {
    expect(startDetail(territories)).toBe(2);
    expect(recommendedDetailIndex(territories)).toBe(1);
  });

  it("falls back to the recommended detail, then the first, for a detail it has no detail for", () => {
    expect(startDetail({ ...territories, detail: 9 })).toBe(1);
    expect(
      startDetail({ ...territories, detail: 9, recommendedDetail: 8 }),
    ).toBe(0);
  });

  it("fills the track up to the selected detail", () => {
    expect([sliderFill(territories, 0), sliderFill(territories, 3)]).toEqual([
      0, 1,
    ]);
    expect(sliderFill({ ...territories, details: [detail(1, [])] }, 0)).toBe(0);
  });

  it("words the status and the recommendation", () => {
    expect(detailStatus(detail(2, [], 11))).toBe(
      "11 non-overlapping territories",
    );
    expect(recommendationHeadline(territories)).toBe(
      "Detail 2 · 11 territories for 7 active contributors",
    );
  });
});

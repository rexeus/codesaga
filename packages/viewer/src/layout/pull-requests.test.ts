import { describe, expect, it } from "vitest";

import { layoutPullRequests } from "./pull-requests.js";

// 354 x 140 leaves a 310 x 100 plot; 20 pull requests in the busiest month
// make the axis 0 to 20, so one pull request is 5 px.
const SIZE = { width: 354, height: 140 };

const months = [
  { month: "2024-01", opened: 10, merged: 5 },
  { month: "2024-02", opened: 20, merged: 0 },
];

const layoutOf = () => {
  const layout = layoutPullRequests(months, SIZE);
  if (layout === null) {
    throw new Error("expected a layout");
  }
  return layout;
};

describe("layoutPullRequests", () => {
  it("scales opened and merged bars from the baseline on one axis", () => {
    const [january, february] = layoutOf().pairs;

    expect(
      [january?.openedBar, january?.mergedBar].map((bar) => [
        bar?.y,
        bar?.height,
      ]),
    ).toEqual([
      [50, 50],
      [75, 25],
    ]);
    expect(
      [february?.openedBar, february?.mergedBar].map((bar) => [
        bar?.y,
        bar?.height,
      ]),
    ).toEqual([
      [0, 100],
      [100, 0],
    ]);
  });

  it("places merged right of opened inside the month's hover zone", () => {
    const layout = layoutOf();

    layout.pairs.forEach(({ openedBar, mergedBar }, index) => {
      const zone = layout.zones[index];
      expect(openedBar.x).toBeGreaterThanOrEqual(zone?.x ?? Infinity);
      expect(mergedBar.x).toBeGreaterThanOrEqual(openedBar.x + openedBar.width);
      expect(mergedBar.x + mergedBar.width).toBeLessThanOrEqual(
        (zone?.x ?? 0) + (zone?.width ?? 0),
      );
    });
  });

  it("returns null without months", () => {
    expect(layoutPullRequests([], SIZE)).toBeNull();
  });
});

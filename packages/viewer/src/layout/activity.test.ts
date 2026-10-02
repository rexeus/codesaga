import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { layoutActivity } from "./activity.js";

type Activity = Report["activity"];

// 359 x 140 leaves a 315 x 100 plot (margins: 14 top, 26 bottom, 38 left, 6
// right). The three weeks span 21 days, so one day is 15 px and a week 105 px.
const SIZE = { width: 359, height: 140 };

const week = (start: string, commits: number, added = 0, deleted = 0) => ({
  start,
  commits,
  added,
  deleted,
});

const threeWeeks: Activity = {
  weeks: [
    week("2024-01-01", 4, 100, 40),
    week("2024-01-08", 0),
    week("2024-01-15", 8, 50, 200),
  ],
  months: [{ month: "2024-01", commits: 12, contributors: 2 }],
};

const layoutOf = (activity: Activity) => {
  const layout = layoutActivity(activity, SIZE);
  if (layout === null) {
    throw new Error("expected a layout");
  }
  return layout;
};

describe("layoutActivity weekly bars", () => {
  it("places one bar per week, centred in its 105 px slot and capped at 16 px", () => {
    const { commits, plot, resolution } = layoutOf(threeWeeks);

    expect(plot).toEqual({ width: 315, height: 100 });
    expect(resolution).toBe("weeks");
    expect(commits.bars.map(({ x, width }) => [x, width])).toEqual([
      [44.5, 16],
      [149.5, 16],
      [254.5, 16],
    ]);
  });

  it("scales bar heights to the largest week, with empty weeks as zero", () => {
    const { commits } = layoutOf(threeWeeks);

    // the axis is rounded up to 8, the busiest week
    expect(commits.bars.map(({ height }) => height)).toEqual([50, 0, 100]);
  });

  it("mirrors lines added above and deleted below one shared zero line", () => {
    const { churn } = layoutOf(threeWeeks);

    // the largest of 200 deleted and 100 added sets both halves: 200 → 50 px
    expect(churn.zero).toBe(50);
    expect(churn.added.map(({ y, height }) => [y, height])).toEqual([
      [25, 25],
      [50, 0],
      [37.5, 12.5],
    ]);
    expect(churn.deleted.map(({ y, height }) => [y, height])).toEqual([
      [50, 10],
      [50, 0],
      [50, 50],
    ]);
  });

  it("draws each month's contributors as a bar over the month's span of the shared time axis", () => {
    const { contributors } = layoutOf(threeWeeks);

    // January alone spans the 315 px; the bar is 12 px wide at most
    expect(
      contributors.bars.map(({ bar, month, contributors: n }) => [
        bar.x,
        bar.width,
        month,
        n,
      ]),
    ).toEqual([[151.5, 12, "Jan 2024", 2]]);
  });
});

const manyWeeks = (count: number): Activity => ({
  weeks: Array.from({ length: count }, (_, index) =>
    week(
      new Date(Date.UTC(2024, 0, 1 + index * 7)).toISOString().slice(0, 10),
      1,
    ),
  ),
  months: [{ month: "2024-01", commits: count, contributors: 1 }],
});

describe("layoutActivity commit marks", () => {
  it("marks the busiest week as the peak", () => {
    const { commits } = layoutOf(threeWeeks);

    // the third week's 16 px bar is centred at 262.5 and its top is the plot
    // top; the label has under 60 px to the right of it
    expect(commits.peak).toEqual({
      x: 262.5,
      y: 0,
      commits: 8,
      anchor: "end",
    });
  });

  it("puts the average of all weeks on the same scale as the bars", () => {
    const { commits } = layoutOf(threeWeeks);

    // (4 + 0 + 8) / 3 = 4 commits of an axis up to 8
    expect(commits.average).toEqual({ value: 4, y: 50 });
  });

  it("emphasises the last 12 weeks only for a history of at least 26 weeks", () => {
    const wide = { width: 1000, height: 140 };

    expect(layoutActivity(manyWeeks(26), wide)?.commits.recentFrom).toBe(14);
    expect(layoutActivity(manyWeeks(25), wide)?.commits.recentFrom).toBeNull();
  });
});

describe("layoutActivity resolution", () => {
  it("switches to monthly bars when weekly bars would be under 2 px", () => {
    const weeks = Array.from({ length: 200 }, (_, index) =>
      week(
        new Date(Date.UTC(2020, 0, 6 + index * 7)).toISOString().slice(0, 10),
        1,
        10,
        5,
      ),
    );
    const activity: Activity = {
      weeks,
      months: [
        { month: "2020-01", commits: 4, contributors: 1 },
        { month: "2020-02", commits: 5, contributors: 1 },
      ],
    };

    const { resolution, buckets } = layoutOf(activity);

    expect(resolution).toBe("months");
    expect(buckets.map(({ label, commits }) => [label, commits])).toEqual([
      ["Jan 2020", 4],
      ["Feb 2020", 5],
    ]);
  });

  it("counts a week's lines for the month of its Monday when it switches to months", () => {
    const weeks = Array.from({ length: 400 }, (_, index) =>
      week(
        new Date(Date.UTC(2020, 0, 6 + index * 7)).toISOString().slice(0, 10),
        1,
        10,
        5,
      ),
    );
    const activity: Activity = {
      weeks,
      months: [{ month: "2020-01", commits: 4, contributors: 1 }],
    };

    const [january] = layoutOf(activity).buckets;

    // Mondays of January 2020: the 6th, 13th, 20th and 27th
    expect(january).toMatchObject({ added: 40, deleted: 20 });
  });

  it("returns null without any week or month", () => {
    expect(layoutActivity({ weeks: [], months: [] }, SIZE)).toBeNull();
  });
});

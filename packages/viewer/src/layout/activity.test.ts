import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { layoutActivity } from "./activity.js";

type Activity = Report["activity"];

// 366 x 132 leaves a 310 x 100 plot (margins: 8 top, 24 bottom, 44 left, 12
// right). January 2024 spans 31 days, so one day is 10 px and a week 70 px.
const SIZE = { width: 366, height: 132 };

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
  it("places one bar per week, centred in its 70 px slot and capped at 24 px", () => {
    const { commits, plot, resolution } = layoutOf(threeWeeks);

    expect(plot).toEqual({ width: 310, height: 100 });
    expect(resolution).toBe("weeks");
    expect(commits.bars.map(({ x, width }) => [x, width])).toEqual([
      [23, 24],
      [93, 24],
      [163, 24],
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

  it("puts each month's contributors on the shared time axis", () => {
    const { contributors } = layoutOf(threeWeeks);

    // mid-January is 15.5 days after the domain start
    expect(contributors.points.map(({ x, contributors: n }) => [x, n])).toEqual(
      [[155, 2]],
    );
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
      ["2020-01", 4],
      ["2020-02", 5],
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

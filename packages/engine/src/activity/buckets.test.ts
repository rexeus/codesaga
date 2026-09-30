import { describe, expect, it } from "vitest";

import { at } from "../testing/classified-commit.js";
import {
  localDayOf,
  localHourOf,
  monthOf,
  monthsOf,
  weekdayOfDay,
  weekStartOf,
  weeksOf,
} from "./buckets.js";

describe("weekStartOf", () => {
  it("starts a week on Monday, so a Sunday belongs to the week before", () => {
    // 2026-03-01 is a Sunday, 2026-03-02 a Monday
    expect(weekStartOf(at("2026-03-01T12:00:00Z"))).toBe("2026-02-23");
    expect(weekStartOf(at("2026-03-02T00:00:00Z"))).toBe("2026-03-02");
  });

  it("returns the Monday itself for a commit on Monday", () => {
    expect(weekStartOf(at("2026-03-02T23:59:59Z"))).toBe("2026-03-02");
  });

  it("crosses a year boundary without skipping or repeating a week", () => {
    // 2025-12-29 is a Monday; 2026-01-01 a Thursday of that week
    expect(weekStartOf(at("2026-01-01T12:00:00Z"))).toBe("2025-12-29");
    expect(weekStartOf(at("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
  });

  it("handles times before the epoch", () => {
    // 1969-12-31 is a Wednesday
    expect(weekStartOf(at("1969-12-31T12:00:00Z"))).toBe("1969-12-29");
  });
});

describe("monthOf", () => {
  it("puts the last second of a month into that month", () => {
    expect(monthOf(at("2026-01-31T23:59:59Z"))).toBe("2026-01");
    expect(monthOf(at("2026-02-01T00:00:00Z"))).toBe("2026-02");
  });
});

describe("local time", () => {
  it("reads the local day and hour of an author behind UTC", () => {
    // 2026-03-02T01:30Z at -05:00 is Sunday 2026-03-01, 20:30
    const time = at("2026-03-02T01:30:00Z");

    expect(weekdayOfDay(localDayOf(time, -300))).toBe(6);
    expect(localHourOf(time, -300)).toBe(20);
  });

  it("reads the local day and hour of an author ahead of UTC", () => {
    // 2026-03-01T22:30Z at +02:00 is Monday 2026-03-02, 00:30
    const time = at("2026-03-01T22:30:00Z");

    expect(weekdayOfDay(localDayOf(time, 120))).toBe(0);
    expect(localHourOf(time, 120)).toBe(0);
  });
});

describe("weeksOf", () => {
  it("lists consecutive Monday starts from the window's first to its last week", () => {
    const window = {
      since: "2025-12-30T00:00:00.000Z",
      until: "2026-01-14T12:00:00.000Z",
    };

    expect(weeksOf(window)).toStrictEqual([
      "2025-12-29",
      "2026-01-05",
      "2026-01-12",
    ]);
  });

  it("returns one week when the window lies inside a single week", () => {
    const window = {
      since: "2026-03-03T00:00:00.000Z",
      until: "2026-03-05T00:00:00.000Z",
    };

    expect(weeksOf(window)).toStrictEqual(["2026-03-02"]);
  });
});

describe("monthsOf", () => {
  it("lists consecutive months across a year boundary, including empty ones", () => {
    const window = {
      since: "2025-11-20T00:00:00.000Z",
      until: "2026-02-03T00:00:00.000Z",
    };

    expect(monthsOf(window)).toStrictEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("returns one month when the window lies inside it", () => {
    const window = {
      since: "2026-03-01T00:00:00.000Z",
      until: "2026-03-31T23:59:59.000Z",
    };

    expect(monthsOf(window)).toStrictEqual(["2026-03"]);
  });
});

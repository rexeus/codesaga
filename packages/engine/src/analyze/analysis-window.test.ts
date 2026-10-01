import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import {
  InvalidCompare,
  InvalidSince,
  resolveComparedRanges,
  resolveTimeRange,
} from "./analysis-window.js";

const setNow = TestClock.setTime(Date.parse("2026-06-15T10:30:00Z"));

describe("resolveTimeRange", () => {
  it.effect.each([
    { since: "30d", expected: "2026-05-16T10:30:00.000Z" },
    { since: "2w", expected: "2026-06-01T10:30:00.000Z" },
    { since: "12m", expected: "2025-06-15T10:30:00.000Z" },
    { since: "1y", expected: "2025-06-15T10:30:00.000Z" },
    { since: "2026-01-31", expected: "2026-01-31T00:00:00.000Z" },
  ])("resolves $since against the clock to $expected", ({ since, expected }) =>
    Effect.gen(function* () {
      yield* setNow;

      const range = yield* resolveTimeRange(since);

      assert.deepStrictEqual(range, {
        since: expected,
        until: "2026-06-15T10:30:00.000Z",
      });
    }),
  );

  it.effect.each([
    "",
    "0d",
    "12",
    "5x",
    "-3d",
    "3 d",
    "2026-02-30",
    "2026-1-1",
    "yesterday",
    // after the clock's now of 2026-06-15
    "2026-06-16",
    "2030-01-01",
    // before the earliest date JavaScript can represent
    "999999999y",
    "999999999m",
  ])("rejects %j", (since) =>
    Effect.gen(function* () {
      yield* setNow;

      const failure = yield* Effect.flip(resolveTimeRange(since));

      assert.deepStrictEqual(failure, new InvalidSince({ input: since }));
    }),
  );
});

const comparedCases = [
  {
    now: "2026-06-15T10:30:00Z",
    duration: "30d",
    previous: ["2026-04-16T10:30:00.000Z", "2026-05-16T10:30:00.000Z"],
  },
  {
    now: "2026-06-15T10:30:00Z",
    duration: "2w",
    previous: ["2026-05-18T10:30:00.000Z", "2026-06-01T10:30:00.000Z"],
  },
  {
    now: "2026-06-15T10:30:00Z",
    duration: "3m",
    previous: ["2025-12-15T10:30:00.000Z", "2026-03-15T10:30:00.000Z"],
  },
  // February has no 31st: both months end on the last day they have
  {
    now: "2026-03-31T00:00:00Z",
    duration: "1m",
    previous: ["2026-01-28T00:00:00.000Z", "2026-02-28T00:00:00.000Z"],
  },
  // the leap day lies in the current year, so it is one day longer than the year before
  {
    now: "2028-06-15T00:00:00Z",
    duration: "1y",
    previous: ["2026-06-15T00:00:00.000Z", "2027-06-15T00:00:00.000Z"],
  },
];

describe("resolveComparedRanges", () => {
  it.effect.each(comparedCases)(
    "ends the previous $duration at the start of the current one on $now",
    ({ now, duration, previous }) =>
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse(now));

        const ranges = yield* resolveComparedRanges(duration);

        assert.deepStrictEqual(ranges, {
          current: { since: previous[1], until: new Date(now).toISOString() },
          previous: { since: previous[0], until: previous[1] },
        });
      }),
  );

  it.effect.each([
    "",
    "0d",
    "3",
    "5x",
    "-3d",
    // a date is not a duration
    "2026-01-31",
    // the previous span would start before the earliest date JavaScript can represent
    "999999999y",
    "999999999m",
  ])("rejects %j", (duration) =>
    Effect.gen(function* () {
      yield* setNow;

      const failure = yield* Effect.flip(resolveComparedRanges(duration));

      assert.deepStrictEqual(
        failure,
        new InvalidCompare({ input: duration, reason: "duration" }),
      );
    }),
  );
});

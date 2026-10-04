import { describe, expect, it } from "vitest";

import type { ClassifiedCommit } from "../automation/classify.js";
import { classifiedCommit } from "../testing/classified-commit.js";
import { badgeNow } from "../testing/contributor-badge-facts.js";
import { rhythmBadges } from "./contributor-rhythm.js";

const WEEK = 7;

/**
 * A commit on `weekday` (0 Monday to 6 Sunday) of the `week`-th week after
 * Monday 2025-08-04, at `time` on the author's clock with `offset`.
 */
const local = (
  week: number,
  weekday: number,
  time: string,
  offset = "+00:00",
): ClassifiedCommit => {
  const date = new Date(Date.UTC(2025, 7, 4 + WEEK * week + weekday))
    .toISOString()
    .slice(0, 10);
  const sign = offset.startsWith("-") ? -1 : 1;
  const [hours = 0, minutes = 0] = offset.slice(1).split(":").map(Number);
  return classifiedCommit({
    time: Date.parse(`${date}T${time}${offset}`) / 1000,
    offsetMinutes: sign * (hours * 60 + minutes),
  });
};

/** `count` commits on consecutive Mondays, one per week. */
const mondays = (
  count: number,
  time: string,
  offset = "+00:00",
  overrides: Partial<ClassifiedCommit> = {},
) =>
  Array.from({ length: count }, (_, week) => ({
    ...local(week, 0, time, offset),
    ...overrides,
  }));

const kinds = (
  commits: ReadonlyArray<ClassifiedCommit>,
  otherOffsets = false,
) => rhythmBadges(commits, badgeNow, otherOffsets).map(({ kind }) => kind);

describe("rhythmBadges night owl", () => {
  it("awards it with a quarter of the commits between 22:00 and 05:00 and says how many", () => {
    const commits = [...mondays(10, "23:00:00"), ...mondays(30, "12:00:00")];

    expect(rhythmBadges(commits, badgeNow, false)).toStrictEqual([
      {
        kind: "night-owl",
        label: "Night owl",
        evidence:
          "Often commits late: 25% of their commits in the last year between 22:00 and 05:00 (10 of 40).",
      },
    ]);
  });

  it("withholds it just below a quarter", () => {
    const commits = [...mondays(9, "23:00:00"), ...mondays(31, "12:00:00")];

    expect(kinds(commits)).toStrictEqual([]);
  });

  it("counts 22:00 and 04:59 as night and 05:00 as morning", () => {
    expect(kinds(mondays(40, "22:00:00"))).toStrictEqual(["night-owl"]);
    expect(kinds(mondays(40, "04:59:00"))).toStrictEqual(["night-owl"]);
    expect(kinds(mondays(40, "21:59:00"))).toStrictEqual([]);
  });

  it("reads the author's clock: 23:30 at +02:00 is night although it is 21:30 in UTC", () => {
    const commits = [
      ...mondays(10, "23:30:00", "+02:00"),
      ...mondays(30, "12:00:00", "+02:00"),
    ];

    expect(kinds(commits, true)).toStrictEqual(["night-owl"]);
    expect(kinds(mondays(40, "21:30:00"))).toStrictEqual([]);
  });
});

describe("rhythmBadges early bird and weekend regular", () => {
  it("awards early bird from 05:00 up to but not including 08:00", () => {
    expect(kinds(mondays(40, "05:00:00"))).toStrictEqual(["early-bird"]);
    expect(kinds(mondays(40, "07:59:00"))).toStrictEqual(["early-bird"]);
    expect(kinds(mondays(40, "08:00:00"))).toStrictEqual([]);
  });

  it("awards weekend regular to a quarter of the commits on a Saturday or Sunday", () => {
    const saturdays = Array.from({ length: 5 }, (_, week) =>
      local(week, 5, "12:00:00"),
    );
    const sundays = Array.from({ length: 5 }, (_, week) =>
      local(week, 6, "12:00:00"),
    );

    expect(
      kinds([...saturdays, ...sundays, ...mondays(30, "12:00:00")]),
    ).toStrictEqual(["weekend-regular"]);
    expect(
      kinds([...saturdays, ...sundays.slice(1), ...mondays(31, "12:00:00")]),
    ).toStrictEqual([]);
  });

  it("reads a negative offset the right way round: 21:30 at -05:00 is evening although it is 02:30 in UTC", () => {
    expect(kinds(mondays(40, "21:30:00", "-05:00"), true)).toStrictEqual([]);
    expect(kinds(mondays(40, "02:00:00", "-05:00"), true)).toStrictEqual([
      "night-owl",
    ]);
    expect(kinds(mondays(40, "06:00:00", "-05:00"), true)).toStrictEqual([
      "early-bird",
    ]);
  });

  it("takes the weekend from the author's local day", () => {
    const earlySaturdays = Array.from({ length: 10 }, (_, week) =>
      local(week, 5, "00:30:00", "+02:00"),
    );

    expect(
      kinds([...earlySaturdays, ...mondays(30, "12:00:00", "+02:00")], true),
    ).toStrictEqual(["night-owl", "weekend-regular"]);
  });

  it("lists every rhythm a person has, in the order night owl, early bird, weekend regular", () => {
    const commits = [
      ...mondays(14, "23:00:00"),
      ...mondays(14, "06:00:00"),
      ...Array.from({ length: 14 }, (_, week) => local(week, 5, "12:00:00")),
    ];

    expect(kinds(commits)).toStrictEqual([
      "night-owl",
      "early-bird",
      "weekend-regular",
    ]);
  });
});

describe("rhythmBadges minimum evidence", () => {
  it("withholds every rhythm below 40 human commits", () => {
    expect(kinds(mondays(39, "23:00:00"))).toStrictEqual([]);
  });

  it("withholds every rhythm when the commits span fewer than 3 calendar months", () => {
    const twoMonths = [
      ...Array.from({ length: 20 }, () => local(0, 0, "23:00:00")),
      ...Array.from({ length: 20 }, () => local(4, 0, "23:00:00")),
    ];
    const threeMonths = [...twoMonths, local(9, 0, "23:00:00")];

    expect(kinds(twoMonths)).toStrictEqual([]);
    expect(kinds(threeMonths)).toStrictEqual(["night-owl"]);
  });

  it("ignores agent-assisted commits, whose clock is the agent's", () => {
    const assisted = mondays(40, "23:00:00", "+00:00", {
      class: "agent-assisted",
    });

    expect(kinds([...mondays(40, "12:00:00"), ...assisted])).toStrictEqual([]);
    expect(kinds([...mondays(39, "23:00:00"), ...assisted])).toStrictEqual([]);
  });

  it("reads only the last 365 days", () => {
    const lastYear = [...mondays(30, "12:00:00"), ...mondays(10, "23:00:00")];
    const before = Array.from({ length: 40 }, () =>
      classifiedCommit({ time: Date.parse("2025-06-30T23:00:00Z") / 1000 }),
    );

    expect(kinds([...lastYear, ...before])).toStrictEqual(["night-owl"]);
    expect(kinds(before)).toStrictEqual([]);
  });
});

describe("rhythmBadges untrustworthy clocks", () => {
  it("withholds every rhythm when 90% of the commits say +00:00 and the history has other offsets", () => {
    const commits = [
      ...mondays(36, "23:00:00"),
      ...mondays(4, "23:00:00", "+02:00"),
    ];

    expect(kinds(commits, true)).toStrictEqual([]);
  });

  it("keeps them just below that share, and when nobody has another offset", () => {
    const commits = [
      ...mondays(35, "23:00:00"),
      ...mondays(5, "23:00:00", "+02:00"),
    ];

    expect(kinds(commits, true)).toStrictEqual(["night-owl"]);
    expect(kinds(mondays(40, "23:00:00"), false)).toStrictEqual(["night-owl"]);
  });
});

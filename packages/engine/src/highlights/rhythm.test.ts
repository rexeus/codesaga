import { describe, expect, it } from "vitest";

import { commitsAt, highlightFacts } from "../testing/highlight-facts.js";
import { rhythmHighlights } from "./rhythm.js";

const highlightsOf = (times: ReadonlyArray<string>, extra = {}) =>
  rhythmHighlights(highlightFacts({ commits: commitsAt(times, extra) }));

const kindsOf = (times: ReadonlyArray<string>, extra = {}) =>
  highlightsOf(times, extra).map(({ kind }) => kind);

/** `count` noon commits spread over weekdays from Monday 2026-06-01, one per day. */
const weekdayNoons = (count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) =>
    new Date(
      Date.UTC(2026, 5, 1 + (index % 5) + 7 * Math.floor(index / 5), 12),
    ).toISOString(),
  );

/** A sample of 20 weekday commits where the first `replaced` happen at `time` of day instead. */
const withReplaced = (replaced: number, time: string) =>
  weekdayNoons(20).map((noon, index) =>
    index < replaced ? `${noon.slice(0, 10)}T${time}Z` : noon,
  );

const days = (from: number, to: number) =>
  Array.from(
    { length: to - from + 1 },
    (_, index) => `2026-06-${String(from + index).padStart(2, "0")}T12:00:00Z`,
  );

const dayOf = (count: number) =>
  Array.from({ length: count }, () => "2026-03-10T09:00:00Z");

// Saturday 2026-06-06 and Sunday 2026-06-07
const withWeekend = (weekendCommits: number) => [
  ...weekdayNoons(20 - weekendCommits),
  ...["2026-06-06T12:00:00Z", "2026-06-07T12:00:00Z"]
    .flatMap((time) => [time, time, time])
    .slice(0, weekendCommits),
];

describe("rhythmHighlights streak", () => {
  it("reports the longest run of days with a commit at 7 days", () => {
    const [streak] = highlightsOf([...days(1, 3), ...days(10, 16)]);

    expect(streak).toStrictEqual({
      kind: "streak",
      title: "Longest streak",
      detail: "A commit landed every day from 2026-06-10 to 2026-06-16.",
      value: 7,
      date: "2026-06-10",
    });
  });

  it("reports no streak at 6 days", () => {
    expect(kindsOf(days(10, 15))).not.toContain("streak");
  });

  it("counts a commit on the author's local day, not the UTC day", () => {
    // 23:30 UTC on June 3 is June 4, 01:30 at +02:00: only then are the days consecutive
    const times = [...days(1, 3), ...days(5, 7)];
    const local = commitsAt(["2026-06-03T23:30:00Z"], { offsetMinutes: 120 });

    const [streak] = rhythmHighlights(
      highlightFacts({ commits: [...commitsAt(times), ...local] }),
    );

    expect(streak).toMatchObject({
      kind: "streak",
      value: 7,
      date: "2026-06-01",
    });
  });
});

describe("rhythmHighlights busiest day", () => {
  it("reports the day with the most commits at 5 commits", () => {
    const [busiest] = highlightsOf([...dayOf(5), "2026-03-11T09:00:00Z"]);

    expect(busiest).toStrictEqual({
      kind: "busiest-day",
      title: "Busiest day",
      detail: "5 commits landed on 2026-03-10, the most on a single day.",
      value: 5,
      date: "2026-03-10",
    });
  });

  it("reports no busiest day at 4 commits", () => {
    expect(kindsOf(dayOf(4))).not.toContain("busiest-day");
  });

  it("counts commits of bots and agents", () => {
    expect(
      kindsOf(dayOf(5), { class: "bot", tools: ["Dependabot"] }),
    ).toContain("busiest-day");
  });
});

describe("rhythmHighlights night owls", () => {
  it("reports night owls when 20 percent of the human commits fall at night", () => {
    const [owls] = highlightsOf(withReplaced(4, "23:00:00"));

    expect(owls).toStrictEqual({
      kind: "night-owls",
      title: "Night owls",
      detail:
        "20% of the human commits land between 22:00 and 05:00 local time (4 of 20).",
      value: 0.2,
    });
  });

  it("reports no night owls below 20 percent", () => {
    expect(kindsOf(withReplaced(3, "23:00:00"))).not.toContain("night-owls");
  });

  it("counts 22:00 to 04:59 as night and 21:59 and 05:00 as day", () => {
    const night = withReplaced(2, "22:00:00").map((time, index) =>
      index === 2 || index === 3 ? `${time.slice(0, 10)}T04:59:00Z` : time,
    );
    const day = withReplaced(2, "21:59:00").map((time, index) =>
      index === 2 || index === 3 ? `${time.slice(0, 10)}T05:00:00Z` : time,
    );

    expect(kindsOf(night)).toContain("night-owls");
    expect(kindsOf(day)).not.toContain("night-owls");
  });

  it("reads the hour in the author's local time", () => {
    // 20:00 UTC is 23:00 at +03:00
    const kinds = kindsOf(withReplaced(4, "20:00:00"), { offsetMinutes: 180 });

    expect(kinds).toContain("night-owls");
  });

  it("reports nothing about shares of fewer than 20 human commits", () => {
    expect(kindsOf(withReplaced(19, "23:00:00").slice(0, 19))).toStrictEqual(
      [],
    );
  });

  it("leaves bot and agent commits out of the shares", () => {
    const humans = commitsAt(weekdayNoons(20));
    const bots = commitsAt(withReplaced(20, "23:00:00"), {
      class: "agent",
      tools: ["Claude Code"],
    });

    const found = rhythmHighlights(
      highlightFacts({ commits: [...humans, ...bots] }),
    );

    expect(found.map(({ kind }) => kind)).not.toContain("night-owls");
  });
});

describe("rhythmHighlights weekend", () => {
  it("reports the weekend share at 25 percent", () => {
    const weekend = highlightsOf(withWeekend(5)).find(
      ({ kind }) => kind === "weekend",
    );

    expect(weekend).toStrictEqual({
      kind: "weekend",
      title: "Weekends",
      detail:
        "25% of the human commits land on a Saturday or Sunday (5 of 20).",
      value: 0.25,
    });
  });

  it("reports no weekend share below 25 percent", () => {
    expect(kindsOf(withWeekend(4))).not.toContain("weekend");
  });
});

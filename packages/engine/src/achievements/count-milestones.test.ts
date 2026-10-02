import { describe, expect, it } from "vitest";

import { achievementOf, commitsEvery } from "../testing/achievement-facts.js";
import { at, classifiedCommit } from "../testing/classified-commit.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("achievements first-commits", () => {
  it("stays locked at 999 commits and shows the way to 1,000", () => {
    expect(
      achievementOf("first-commits", {
        commits: commitsEvery("2020-01-01T00:00:00Z", HOUR, 999),
      }),
    ).toStrictEqual({
      kind: "first-commits",
      title: "First 1,000 commits",
      tiers: [1000, 10_000],
      reached: false,
      reachedAt: null,
      holds: "milestone",
      detail: "999 commits so far.",
      progress: { value: 999, target: 1000, unit: "commits" },
    });
  });

  it("reaches the first tier at 1,000 commits on the day of the 1,000th", () => {
    expect(
      achievementOf("first-commits", {
        commits: commitsEvery("2020-01-01T00:00:00Z", HOUR, 1000),
      }),
    ).toStrictEqual({
      kind: "first-commits",
      title: "First 1,000 commits",
      tier: 1,
      tiers: [1000, 10_000],
      reached: true,
      reachedAt: "2020-02-11",
      holds: "milestone",
      detail: "The 1,000th commit landed on 2020-02-11.",
      progress: { value: 1000, target: 10_000, unit: "commits" },
    });
  });

  it("names the second tier at 10,000 commits and has nothing left to reach", () => {
    expect(
      achievementOf("first-commits", {
        commits: commitsEvery("2020-01-01T00:00:00Z", HOUR, 10_000),
      }),
    ).toMatchObject({
      title: "First 10,000 commits",
      tier: 2,
      reachedAt: "2021-02-20",
      detail: "The 10,000th commit landed on 2021-02-20.",
      progress: null,
    });
  });

  it("counts the commits of bots and agents as well", () => {
    expect(
      achievementOf("first-commits", {
        commits: commitsEvery("2020-01-01T00:00:00Z", HOUR, 1000, (index) =>
          index % 2 === 0 ? { class: "bot", tools: ["x"] } : {},
        ),
      }),
    ).toMatchObject({ reached: true });
  });
});

/** The marathon of a history of two commits, the last `lastOffsetMs` after the first on 2020-01-01. */
const marathonSpanning = (lastOffsetMs: number) =>
  achievementOf("marathon", {
    commits: [
      classifiedCommit({
        time: at("2020-01-01T00:00:00Z") + lastOffsetMs / 1000,
      }),
      classifiedCommit({ time: at("2020-01-01T00:00:00Z") }),
    ],
  });

describe("achievements marathon", () => {
  it("stays locked one second short of 1,000 days between the first and the last commit", () => {
    expect(marathonSpanning(1000 * DAY - 1000)).toStrictEqual({
      kind: "marathon",
      title: "Marathon",
      reached: false,
      reachedAt: null,
      holds: "milestone",
      detail: "999 days of history since 2020-01-01.",
      progress: { value: 999, target: 1000, unit: "days" },
    });
  });

  it("is reached at exactly 1,000 days, dated 1,000 days after the first commit", () => {
    expect(marathonSpanning(1000 * DAY)).toMatchObject({
      reached: true,
      reachedAt: "2022-09-27",
      detail: "1,000 days of history since 2020-01-01.",
      progress: null,
    });
  });

  it("has no history to measure before the first commit", () => {
    expect(achievementOf("marathon")).toMatchObject({
      reached: false,
      detail: "No history yet.",
      progress: { value: 0, target: 1000, unit: "days" },
    });
  });
});

const person = (index: number) => ({
  author: { name: `Person ${index}`, email: `p${index}@example.com` },
});

/** One person per day from 2026-01-01; the first person commits again each day, and a bot joins too. */
const team = (people: number) =>
  achievementOf("community", {
    commits: [
      classifiedCommit({
        class: "bot",
        tools: ["Dependabot"],
        author: { name: "bot", email: "bot@example.com" },
      }),
      ...commitsEvery("2026-01-01T00:00:00Z", DAY, people, person),
      ...commitsEvery("2026-01-01T12:00:00Z", DAY, people, () => person(0)),
    ],
  });

describe("achievements community tiers", () => {
  it.each([
    [9, undefined, null, "9 contributors so far."],
    [
      10,
      1,
      "2026-01-10",
      "10 people have committed; the 10th joined 2026-01-10.",
    ],
    [
      49,
      1,
      "2026-01-10",
      "49 people have committed; the 10th joined 2026-01-10.",
    ],
    [
      50,
      2,
      "2026-02-19",
      "50 people have committed; the 50th joined 2026-02-19.",
    ],
    [
      100,
      3,
      "2026-04-10",
      "100 people have committed; the 100th joined 2026-04-10.",
    ],
  ])(
    "with %i people has tier %s, reached on %s: %s",
    (people, tier, reachedAt, detail) => {
      const community = team(people);

      expect(community?.tier).toBe(tier);
      expect(community?.reachedAt).toBe(reachedAt);
      expect(community?.detail).toBe(detail);
    },
  );
});

describe("achievements community progress", () => {
  it("shows the way to the next tier and none after the last", () => {
    expect(team(9)?.progress).toStrictEqual({
      value: 9,
      target: 10,
      unit: "contributors",
    });
    expect(team(10)?.progress).toStrictEqual({
      value: 10,
      target: 50,
      unit: "contributors",
    });
    expect(team(100)?.progress).toBeNull();
  });

  it("names nobody", () => {
    expect(JSON.stringify(team(100))).not.toMatch(/Person|example\.com/u);
  });
});

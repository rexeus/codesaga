import { describe, expect, it } from "vitest";

import {
  achievementOf,
  changing,
  commitsEvery,
} from "../testing/achievement-facts.js";

const DAY = 24 * 3_600_000;

const run = (days: number, start = "2026-02-01T09:00:00Z") =>
  commitsEvery(start, DAY, days);

describe("achievements unbroken", () => {
  it("stays locked at a 29-day streak and shows the longest one", () => {
    expect(achievementOf("unbroken", { commits: run(29) })).toStrictEqual({
      kind: "unbroken",
      title: "Unbroken",
      reached: false,
      reachedAt: null,
      holds: "milestone",
      detail: "Longest streak: 29 days with a commit every day.",
      progress: { value: 29, target: 30, unit: "days in a row" },
    });
  });

  it("is reached on the 30th day of a streak", () => {
    expect(achievementOf("unbroken", { commits: run(30) })).toMatchObject({
      reached: true,
      reachedAt: "2026-03-02",
      progress: null,
    });
  });

  it("starts counting again after a day without a commit", () => {
    const commits = [
      ...run(30, "2026-04-02T09:00:00Z"),
      ...run(20, "2026-01-01T09:00:00Z"),
    ];

    expect(achievementOf("unbroken", { commits })).toMatchObject({
      reached: true,
      reachedAt: "2026-05-01",
    });
  });

  it("dates the streak by the authors' local days", () => {
    const commits = commitsEvery("2026-02-01T22:30:00Z", DAY, 30, () => ({
      offsetMinutes: 180,
    }));

    expect(achievementOf("unbroken", { commits })?.reachedAt).toBe(
      "2026-03-03",
    );
  });
});

describe("achievements spring-cleaning", () => {
  it("stays locked one line short and shows the biggest cleanup", () => {
    const commits = [
      changing(
        "2026-01-01T09:00:00Z",
        { "a.ts": [0, 999] },
        "Drop the old API",
      ),
    ];

    expect(achievementOf("spring-cleaning", { commits })).toStrictEqual({
      kind: "spring-cleaning",
      title: "Spring cleaning",
      reached: false,
      reachedAt: null,
      holds: "milestone",
      detail:
        'One commit removed 999 more code lines than it added: "Drop the old API".',
      progress: { value: 999, target: 1000, unit: "net lines removed" },
    });
  });

  it("is reached by a commit that removed exactly 1,000 net lines, deleting and adding together", () => {
    const commits = [
      changing("2026-01-01T09:00:00Z", {
        "a.ts": [500, 800],
        "b.ts": [0, 700],
      }),
    ];

    expect(achievementOf("spring-cleaning", { commits })).toMatchObject({
      reached: true,
      reachedAt: "2026-01-01",
      progress: null,
    });
  });

  it("dates the first commit that passed and tells of the biggest", () => {
    const commits = [
      changing("2026-02-05T09:00:00Z", { "a.ts": [0, 5000] }, "Drop it all"),
      changing("2026-01-05T09:00:00Z", { "a.ts": [0, 1000] }, "Drop some"),
    ];

    expect(achievementOf("spring-cleaning", { commits })).toMatchObject({
      reachedAt: "2026-01-05",
      detail:
        'One commit removed 5,000 more code lines than it added: "Drop it all".',
    });
  });

  it("ignores deleted lines of files that are not code", () => {
    const commits = [changing("2026-01-01T09:00:00Z", { "doc.md": [0, 5000] })];

    expect(
      achievementOf("spring-cleaning", {
        commits,
        isCodePath: (path) => path.endsWith(".ts"),
      }),
    ).toMatchObject({
      reached: false,
      detail: "No commit has removed more code lines than it added.",
      progress: { value: 0, target: 1000, unit: "net lines removed" },
    });
  });
});

import { describe, expect, it } from "vitest";

import { achievementOf, commitsEvery } from "../testing/achievement-facts.js";
import { at, classifiedCommit } from "../testing/classified-commit.js";

const DAY = 24 * 3_600_000;

describe("achievements bus-proof", () => {
  it("stays locked at a truck factor of 4 and shows the way to 5", () => {
    expect(achievementOf("bus-proof", { truckFactor: 4 })).toStrictEqual({
      kind: "bus-proof",
      title: "Bus-proof",
      reached: false,
      reachedAt: null,
      holds: "state",
      detail:
        "Truck factor 4: 4 people must leave before more than half of the files lose every expert.",
      progress: { value: 4, target: 5, unit: "truck factor" },
    });
  });

  it("holds at a truck factor of 5 without a day, since it can be lost again", () => {
    expect(achievementOf("bus-proof", { truckFactor: 5 })).toMatchObject({
      reached: true,
      reachedAt: null,
      holds: "state",
      progress: null,
    });
  });

  it("says no file has an expert at a truck factor of 0", () => {
    expect(achievementOf("bus-proof", { truckFactor: 0 })?.detail).toBe(
      "No file has an expert.",
    );
  });
});

const withTests = (files: number, tests: number) =>
  achievementOf("test-culture", {
    stats: {
      files,
      tests: { files: tests, lines: 0 },
      languages: [],
    },
  });

describe("achievements test-culture", () => {
  it("stays locked just below 30% and rounds the progress down", () => {
    expect(withTests(1000, 299)).toStrictEqual({
      kind: "test-culture",
      title: "Test culture",
      reached: false,
      reachedAt: null,
      holds: "state",
      detail: "299 of 1,000 files are tests (29%).",
      progress: { value: 29, target: 30, unit: "% test files" },
    });
  });

  it("holds at exactly 30%", () => {
    expect(withTests(1000, 300)).toMatchObject({
      reached: true,
      reachedAt: null,
      holds: "state",
      detail: "300 of 1,000 files are tests (30%).",
      progress: null,
    });
  });

  it("is locked without files", () => {
    expect(withTests(0, 0)).toMatchObject({
      reached: false,
      detail: "No code files.",
      progress: { value: 0, target: 30, unit: "% test files" },
    });
  });
});

const newcomer = (index: number, time: string) =>
  classifiedCommit({
    time: at(time),
    author: { name: `N${index}`, email: `n${index}@example.com` },
  });

describe("achievements fresh-blood", () => {
  // The facts' now is 2026-07-01T00:00:00Z; 90 days before is 2026-04-02T00:00:00Z.
  const founder = classifiedCommit({
    time: at("2025-01-01T00:00:00Z"),
    author: { name: "Founder", email: "founder@example.com" },
  });
  const newcomersAt = (...times: ReadonlyArray<string>) =>
    achievementOf("fresh-blood", {
      commits: [...times.map((time, index) => newcomer(index, time)), founder],
    });

  it("holds when five people made their first commit within 90 days, the oldest exactly 90 days ago", () => {
    expect(
      newcomersAt(
        "2026-06-20T00:00:00Z",
        "2026-06-01T00:00:00Z",
        "2026-05-01T00:00:00Z",
        "2026-04-10T00:00:00Z",
        "2026-04-02T00:00:00Z",
      ),
    ).toMatchObject({
      kind: "fresh-blood",
      reached: true,
      reachedAt: null,
      holds: "state",
      detail: "5 people made their first commit in the last 90 days.",
      progress: null,
    });
  });

  it("stays locked when the fifth first commit is a second too old", () => {
    expect(
      newcomersAt(
        "2026-06-20T00:00:00Z",
        "2026-06-01T00:00:00Z",
        "2026-05-01T00:00:00Z",
        "2026-04-10T00:00:00Z",
        "2026-04-01T23:59:59Z",
      ),
    ).toMatchObject({
      reached: false,
      detail: "4 newcomers in the last 90 days.",
      progress: { value: 4, target: 5, unit: "newcomers in 90 days" },
    });
  });

  it("does not count a person who committed before again, nor the founder of a young repository", () => {
    const commits = [
      ...commitsEvery("2026-06-01T00:00:00Z", DAY, 5, (index) => ({
        author: { name: `Y${index}`, email: `y${index}@example.com` },
      })),
    ];

    expect(achievementOf("fresh-blood", { commits })?.progress?.value).toBe(4);
  });
});

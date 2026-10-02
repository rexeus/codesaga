import { describe, expect, it } from "vitest";

import {
  achievementFacts,
  commitsEvery,
} from "../testing/achievement-facts.js";
import { at, classifiedCommit } from "../testing/classified-commit.js";
import { achievements } from "./achievements.js";

const DAY = 24 * 3_600_000;

describe("achievements", () => {
  it("lists all nine kinds in a fixed order, locked, for a repository without commits", () => {
    const list = achievements(achievementFacts());

    expect(
      list.map(({ kind, holds, reached }) => [kind, holds, reached]),
    ).toStrictEqual([
      ["first-commits", "milestone", false],
      ["marathon", "milestone", false],
      ["community", "milestone", false],
      ["bus-proof", "state", false],
      ["polyglot", "milestone", false],
      ["test-culture", "state", false],
      ["unbroken", "milestone", false],
      ["spring-cleaning", "milestone", false],
      ["fresh-blood", "state", false],
    ]);
    expect(list.every(({ reachedAt }) => reachedAt === null)).toBe(true);
  });

  it("keeps reached milestones reached, with their days, and states without one", () => {
    const commits = [
      ...commitsEvery("2026-02-01T09:00:00Z", DAY, 30),
      classifiedCommit({
        time: at("2026-01-01T09:00:00Z"),
        subject: "Drop the old API",
        changes: [{ path: "a.ts", added: 0, deleted: 1200 }],
      }),
    ];

    const list = achievements(
      achievementFacts({
        commits,
        truckFactor: 6,
        stats: {
          files: 10,
          tests: { files: 3, lines: 0 },
          languages: [{ name: "TypeScript", files: 10, lines: 100 }],
        },
      }),
    );

    expect(
      list
        .filter(({ reached }) => reached)
        .map(({ kind, reachedAt }) => [kind, reachedAt]),
    ).toStrictEqual([
      ["bus-proof", null],
      ["test-culture", null],
      ["unbroken", "2026-03-02"],
      ["spring-cleaning", "2026-01-01"],
    ]);
  });
});

describe("achievements in a shallow clone", () => {
  // The oldest commits are missing: a milestone's day could be earlier, and
  // nothing that reads who started when can be told.
  const commits = [
    ...commitsEvery("2026-02-01T09:00:00Z", DAY, 30, (index) => ({
      author: { name: `P${index}`, email: `p${index}@example.com` },
      ...(index === 0
        ? { changes: [{ path: "a.ts", added: 0, deleted: 1500 }] }
        : {}),
    })),
  ];
  const shallow = achievements(
    achievementFacts({
      commits,
      shallow: true,
      truckFactor: 9,
      stats: {
        files: 10,
        tests: { files: 5, lines: 0 },
        languages: [{ name: "TypeScript", files: 10, lines: 100 }],
      },
    }),
  );
  const byKind = (kind: string) => shallow.find((entry) => entry.kind === kind);

  it("reaches a milestone that the commits it has show, but withholds its day", () => {
    expect(byKind("unbroken")).toMatchObject({
      reached: true,
      reachedAt: null,
    });
    expect(byKind("spring-cleaning")).toMatchObject({
      reached: true,
      reachedAt: null,
    });
    expect(byKind("unbroken")?.detail).toMatch(/shallow.*at least/u);
  });

  it("says at least for what it counts and omits the day from the sentence", () => {
    expect(byKind("first-commits")?.detail).toMatch(
      /^30 commits so far\. .*shallow.*at least/u,
    );
    expect(byKind("marathon")?.detail).toMatch(/at least/u);
    expect(byKind("community")?.detail).toMatch(
      /^30 people have committed\. /u,
    );
    expect(byKind("community")?.detail).not.toMatch(/joined/u);
  });

  it("withholds the states that need the full history, whatever the truck factor says", () => {
    for (const kind of ["bus-proof", "fresh-blood"]) {
      expect(byKind(kind)).toMatchObject({
        reached: false,
        reachedAt: null,
        holds: "state",
        progress: null,
      });
      expect(byKind(kind)?.detail).toMatch(/shallow/u);
    }
  });

  it("still tells the tests of the files at HEAD", () => {
    expect(byKind("test-culture")).toMatchObject({ reached: true });
  });
});

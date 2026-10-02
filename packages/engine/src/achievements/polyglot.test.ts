import { describe, expect, it } from "vitest";

import { achievementOf, changing } from "../testing/achievement-facts.js";

const languages = (...lines: ReadonlyArray<number>) =>
  lines.map((count, index) => ({
    name: ["TypeScript", "Python", "Ruby", "Go", "Rust", "Shell"][index] ?? "?",
    files: 1,
    lines: count,
  }));

const statsWith = (...lines: ReadonlyArray<number>) => ({
  files: 10,
  tests: { files: 0, lines: 0 },
  languages: languages(...lines),
});

/** Four languages with at least 1% each of 1,300 lines. */
const fourLanguages = changing("2026-01-01T09:00:00Z", {
  "a.ts": [1000, 0],
  "b.py": [100, 0],
  "c.rb": [100, 0],
  "d.go": [100, 0],
});

describe("achievements polyglot", () => {
  it("is reached when five languages each hold exactly 1% of the code lines", () => {
    expect(
      achievementOf("polyglot", { stats: statsWith(960, 10, 10, 10, 10) }),
    ).toMatchObject({
      reached: true,
      detail: "5 languages: TypeScript, Python, Ruby, Go, Rust.",
      progress: null,
    });
  });

  it("stays locked when the fifth language is just below 1%", () => {
    expect(
      achievementOf("polyglot", { stats: statsWith(961, 10, 10, 10, 9) }),
    ).toMatchObject({
      reached: false,
      reachedAt: null,
      detail: "4 languages: TypeScript, Python, Ruby, Go.",
      progress: { value: 4, target: 5, unit: "languages" },
    });
  });

  it("names five languages and counts the rest", () => {
    expect(
      achievementOf("polyglot", {
        stats: statsWith(100, 100, 100, 100, 100, 100),
      })?.detail,
    ).toBe("6 languages: TypeScript, Python, Ruby, Go, Rust and 1 more.");
  });
});

describe("achievements polyglot without Other", () => {
  it("does not count the files of no listed language as one", () => {
    const stats = {
      files: 10,
      tests: { files: 0, lines: 0 },
      languages: [
        ...languages(100, 100, 100, 100),
        { name: "Other", files: 1, lines: 100 },
      ],
    };

    expect(achievementOf("polyglot", { stats })).toMatchObject({
      reached: false,
      detail: "4 languages: TypeScript, Python, Ruby, Go.",
      progress: { value: 4, target: 5, unit: "languages" },
    });
  });

  it("does not date the milestone at a commit that adds files of no listed language", () => {
    const commits = [
      changing("2026-02-01T09:00:00Z", { "notes.xyz": [500, 0] }),
      fourLanguages,
    ];

    expect(
      achievementOf("polyglot", {
        commits,
        stats: statsWith(1000, 100, 100, 100),
      }),
    ).toMatchObject({ reached: false, reachedAt: null });
  });
});

describe("achievements polyglot history", () => {
  it("dates the milestone at the commit after which five languages each held 1% of the estimated lines", () => {
    const commits = [
      changing("2026-03-01T09:00:00Z", { "e.rs": [5, 0] }),
      changing("2026-02-01T09:00:00Z", { "e.rs": [10, 0] }),
      fourLanguages,
    ];

    expect(
      achievementOf("polyglot", {
        commits,
        stats: statsWith(1000, 100, 100, 100, 15),
      }),
    ).toMatchObject({ reached: true, reachedAt: "2026-03-01" });
  });

  it("passes the share when a commit deletes the lines of the dominant language", () => {
    // 10 of 1,310 lines are 0.76%; after 500 deleted lines 10 of 810 are 1.2%
    const commits = [
      changing("2026-03-01T09:00:00Z", { "a.ts": [0, 500] }),
      changing("2026-02-01T09:00:00Z", { "e.rs": [10, 0] }),
      fourLanguages,
    ];

    expect(
      achievementOf("polyglot", {
        commits,
        stats: statsWith(500, 100, 100, 100, 10),
      }),
    ).toMatchObject({ reached: true, reachedAt: "2026-03-01" });
  });

  it("stays reached when the files today show fewer languages", () => {
    const commits = [
      changing("2026-01-01T09:00:00Z", {
        "a.ts": [100, 0],
        "b.py": [100, 0],
        "c.rb": [100, 0],
        "d.go": [100, 0],
        "e.rs": [100, 0],
      }),
    ];

    expect(
      achievementOf("polyglot", { commits, stats: statsWith(100, 100, 100) }),
    ).toMatchObject({
      reached: true,
      reachedAt: "2026-01-01",
      detail: "Passed in the past; 3 languages: TypeScript, Python, Ruby.",
      progress: null,
    });
  });

  it("dates a language count that only the files today show at the last commit", () => {
    const commits = [changing("2026-05-04T09:00:00Z", {})];

    expect(
      achievementOf("polyglot", {
        commits,
        stats: statsWith(100, 100, 100, 100, 100),
      })?.reachedAt,
    ).toBe("2026-05-04");
  });
});

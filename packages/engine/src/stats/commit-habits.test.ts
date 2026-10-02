import { describe, expect, it } from "vitest";

import { classifiedCommit } from "../testing/classified-commit.js";
import { commitHabits } from "./commit-habits.js";

const commit = (subject: string, ...lines: ReadonlyArray<[string, number]>) =>
  classifiedCommit({
    subject,
    changes: lines.map(([path, added]) => ({ path, added, deleted: 0 })),
  });

const isCode = (path: string) => path.endsWith(".ts");

describe("commitHabits conventional commits", () => {
  it.each([
    "feat: add it",
    "fix(engine): repair it",
    "refactor(a/b)!: rename it",
    "feat!: break it",
    "revert: undo it",
    "Feat: add it",
    "FIX(Engine): repair it",
  ])("recognizes %j", (subject) => {
    expect(
      commitHabits([commit(subject)], isCode).conventionalCommits.conventional,
    ).toBe(1);
  });

  it.each([
    "Add it",
    "feat add it",
    "feat:add it",
    "feature: add it",
    "Merge branch 'x'",
    "fix(): empty scope",
    "",
  ])("rejects %j", (subject) => {
    expect(
      commitHabits([commit(subject)], isCode).conventionalCommits.conventional,
    ).toBe(0);
  });

  it("reports the share of the commits", () => {
    const habits = commitHabits(
      [commit("feat: a"), commit("fix: b"), commit("c"), commit("d")],
      isCode,
    );

    expect(habits.conventionalCommits).toStrictEqual({
      commits: 4,
      conventional: 2,
      share: 0.5,
    });
  });

  it("reports nothing for no commits", () => {
    expect(commitHabits([], isCode)).toStrictEqual({
      conventionalCommits: { commits: 0, conventional: 0, share: 0 },
      commitSize: { commits: 0, median: 0, p90: 0 },
    });
  });
});

describe("commitHabits commit size", () => {
  it("sums the lines added and deleted in code files and skips commits that changed none", () => {
    const habits = commitHabits(
      [
        commit("a", ["a.ts", 10], ["README.md", 500]),
        classifiedCommit({
          changes: [{ path: "b.ts", added: 3, deleted: 7 }],
        }),
        commit("c", ["c.ts", 20]),
        commit("docs only", ["README.md", 50]),
      ],
      isCode,
    );

    // sizes 10, 10 and 20: median 10, p90 interpolates 10 + (20 - 10) * 0.8
    expect(habits.commitSize).toStrictEqual({
      commits: 3,
      median: 10,
      p90: 18,
    });
  });

  it("counts deleted files whatever the universe holds", () => {
    const habits = commitHabits(
      [
        classifiedCommit({
          changes: [{ path: "gone.ts", added: 0, deleted: 40 }],
        }),
      ],
      isCode,
    );

    expect(habits.commitSize).toStrictEqual({
      commits: 1,
      median: 40,
      p90: 40,
    });
  });
});

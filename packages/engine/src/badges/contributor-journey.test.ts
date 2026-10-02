import { describe, expect, it } from "vitest";

import { at } from "../testing/classified-commit.js";
import {
  badgeFacts,
  commit,
  daysAgo,
  kindsOf,
  territory,
} from "../testing/contributor-badge-facts.js";
import { contributorBadges } from "./contributor-badges.js";

// now is 2026-07-01; the four quarters back are (04-01, 07-01], (01-01, 04-01], (2025-10-01, 01-01], (2025-07-01, 10-01]
const everyQuarter = [
  "2026-06-15",
  "2026-03-15",
  "2025-12-15",
  "2025-08-15",
].map((day) => commit(at(`${day}T12:00:00Z`)));

const since = (day: string) => commit(at(`${day}T00:00:00Z`));

describe("contributorBadges long-hauler", () => {
  it("awards it for a first commit 3 years ago and a commit in each of the last 4 quarters", () => {
    const commits = [since("2023-07-01"), ...everyQuarter];

    expect(
      contributorBadges("ada@example.com", badgeFacts(commits)),
    ).toContainEqual({
      kind: "long-hauler",
      category: "journey",
      label: "Long-hauler",
      evidence:
        "First commit on 2023-07-01, 3 years ago, and a commit in each of the last 4 quarters.",
    });
  });

  it("withholds it for a first commit a day short of 3 years", () => {
    expect(kindsOf([since("2023-07-02"), ...everyQuarter])).not.toContain(
      "long-hauler",
    );
  });

  it("withholds it when one of the last 4 quarters has no commit", () => {
    const commits = [since("2020-01-01"), ...everyQuarter.slice(0, 3)];

    expect(kindsOf(commits)).not.toContain("long-hauler");
  });

  it("withholds it in a shallow clone, where the first commit is not known", () => {
    const commits = [since("2020-01-01"), ...everyQuarter];

    expect(kindsOf(commits, { repositoryStart: undefined })).not.toContain(
      "long-hauler",
    );
  });
});

const territories = ["pkg0", "pkg1", "pkg2", "pkg3"].map((path) =>
  territory(path),
);

/** A first commit long ago in pkg0, then one first commit in each of `entered` other territories, `days` days ago. */
const exploring = (entered: ReadonlyArray<string>, days = 30) => [
  commit(daysAgo(400), ["pkg0/f0.ts"]),
  ...entered.map((path, i) => commit(daysAgo(days - i), [`${path}/f0.ts`])),
];

describe("contributorBadges explorer", () => {
  it("awards it for first commits in 3 territories within 90 days and says how many", () => {
    const commits = exploring(["pkg1", "pkg2", "pkg3"]);

    expect(
      contributorBadges(
        "ada@example.com",
        badgeFacts(commits, { territories }),
      ),
    ).toContainEqual({
      kind: "explorer",
      category: "journey",
      label: "Explorer",
      evidence: "First commits in 3 territories in the last 90 days.",
    });
  });

  it("withholds it at 2 territories", () => {
    const commits = exploring(["pkg1", "pkg2"]);

    expect(kindsOf(commits, { territories })).not.toContain("explorer");
  });

  it("counts a first commit exactly 90 days old, and not one 91 days old", () => {
    const edge = exploring(["pkg1", "pkg2", "pkg3"], 90);
    const late = exploring(["pkg1", "pkg2", "pkg3"], 91);

    expect(kindsOf(edge, { territories })).toContain("explorer");
    expect(kindsOf(late, { territories })).not.toContain("explorer");
  });

  it("does not count a territory the person already knew", () => {
    const commits = [
      ...exploring(["pkg1", "pkg2"]),
      commit(daysAgo(300), ["pkg3/f0.ts"]),
      commit(daysAgo(5), ["pkg3/f0.ts"]),
    ];

    expect(kindsOf(commits, { territories })).not.toContain("explorer");
  });
});

describe("contributorBadges explorer withheld", () => {
  it("does not count a territory where the person only had files that are deleted today", () => {
    const commits = [
      ...exploring(["pkg1", "pkg2"]),
      commit(daysAgo(300), ["pkg3/old.ts"]),
      commit(daysAgo(5), ["pkg3/f0.ts"]),
    ];

    expect(kindsOf(commits, { territories })).not.toContain("explorer");
    expect(
      kindsOf(exploring(["pkg1", "pkg2", "pkg3"]), { territories }),
    ).toContain("explorer");
  });

  it("does not take a sibling path with the same prefix for the territory", () => {
    const commits = [
      ...exploring(["pkg1", "pkg2", "pkg3"]),
      commit(daysAgo(300), ["pkg30/old.ts"]),
    ];

    expect(kindsOf(commits, { territories })).toContain("explorer");
  });

  it("does not count the leftover territories", () => {
    const withOther = [
      ...territories.slice(0, 3),
      { ...territory("rest"), kind: "other" as const },
    ];
    const commits = exploring(["pkg1", "pkg2", "rest"]);

    expect(kindsOf(commits, { territories: withOther })).not.toContain(
      "explorer",
    );
  });

  it("leaves the newcomer to new here", () => {
    const newcomer = ["pkg0", "pkg1", "pkg2"].map((path, i) =>
      commit(daysAgo(30 + i), [`${path}/f0.ts`]),
    );

    expect(kindsOf(newcomer, { territories, repositoryStart: 0 })).toContain(
      "new-here",
    );
    expect(
      kindsOf(newcomer, { territories, repositoryStart: 0 }),
    ).not.toContain("explorer");
  });

  it("is withheld in a shallow clone and without territories", () => {
    const commits = exploring(["pkg1", "pkg2", "pkg3"]);

    expect(
      kindsOf(commits, { territories, repositoryStart: undefined }),
    ).not.toContain("explorer");
    expect(kindsOf(commits)).not.toContain("explorer");
  });
});

import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import type { ClassifiedCommit } from "../automation/classify.js";
import { at, classifiedCommit } from "../testing/classified-commit.js";
import { contributorBadges } from "./contributor-badges.js";
import type { ContributorBadgeFacts } from "./contributor-badges.js";

const now = DateTime.makeUnsafe("2026-07-01T00:00:00Z");
const nowSeconds = at("2026-07-01T00:00:00Z");
const ada = "ada@example.com";

const daysAgo = (days: number): number => nowSeconds - days * 86_400;

const commit = (
  time: number,
  paths: ReadonlyArray<string> = ["src/a.ts"],
  deleted = 0,
): ClassifiedCommit =>
  classifiedCommit({
    time,
    changes: paths.map((path) => ({ path, added: 1, deleted })),
  });

/** `count` commits in 2025, the lazy kind: no badge besides what a test adds. */
const old = (count: number, paths?: ReadonlyArray<string>) =>
  Array.from({ length: count }, (_, i) => commit(daysAgo(400 + i), paths));

const facts = (
  commits: ReadonlyArray<ClassifiedCommit>,
  overrides: Partial<ContributorBadgeFacts> = {},
): ContributorBadgeFacts => ({
  commits: commits.toSorted((a, b) => b.time - a.time),
  now,
  isCodePath: (path) => path.endsWith(".ts"),
  repositoryStart: 0,
  historyContributors: 2,
  founded: { files: 0, ofFiles: 100 },
  ...overrides,
});

const kindsOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
  overrides: Partial<ContributorBadgeFacts> = {},
) => contributorBadges(ada, facts(commits, overrides)).map(({ kind }) => kind);

const territory = (
  path: string,
  files = 5,
  activeExperts: ReadonlyArray<string> = [ada],
) => ({
  path,
  kind: "package" as const,
  paths: Array.from({ length: files }, (_, i) => `${path}/f${i}.ts`),
  activeExperts,
});

const territories8 = Array.from({ length: 8 }, (_, i) => territory(`pkg${i}`));
const touching = (count: number) =>
  old(count).map((c, i) => commit(c.time, [`pkg${i}/f0.ts`]));

const split = (inFirst: number, total: number) =>
  old(total).map((c, i) =>
    commit(c.time, [i < inFirst ? "pkg0/f0.ts" : "pkg1/f0.ts"]),
  );

describe("contributorBadges all-rounder and specialist", () => {
  it("awards all-rounder at half of the territories and at least 4", () => {
    const badges = contributorBadges(
      ada,
      facts(touching(4), { territories: territories8 }),
    );

    expect(badges).toContainEqual({
      kind: "all-rounder",
      label: "All-rounder",
      evidence: "Commits in 4 of 8 territories.",
    });
  });

  it("withholds all-rounder below 4 territories, or below half of the territories", () => {
    expect(kindsOf(touching(3), { territories: territories8 })).not.toContain(
      "all-rounder",
    );
    expect(
      kindsOf(touching(4), {
        territories: [...territories8, territory("pkg9")],
      }),
    ).not.toContain("all-rounder");
  });

  it("awards specialist when 80 percent of the commits fall into one territory, and names it", () => {
    const commits = [
      ...old(8).map((c) => commit(c.time, ["pkg0/f0.ts"])),
      ...old(2).map((c) => commit(c.time, ["pkg1/f0.ts"])),
    ];

    expect(
      contributorBadges(ada, facts(commits, { territories: territories8 })),
    ).toContainEqual({
      kind: "specialist",
      label: "pkg0 specialist",
      evidence: "80% of the commits fall into pkg0.",
    });
  });

  it("withholds specialist at 70 percent and below 10 commits", () => {
    expect(kindsOf(split(7, 10), { territories: territories8 })).not.toContain(
      "specialist",
    );
    expect(kindsOf(split(9, 9), { territories: territories8 })).not.toContain(
      "specialist",
    );
  });

  it("withholds all three territory badges without territories, and leaves an other-files territory out", () => {
    const commits = old(10).map((c) => commit(c.time, ["pkg0/f0.ts"]));

    expect(kindsOf(commits)).toStrictEqual([]);
    expect(
      kindsOf(commits, {
        territories: [{ ...territory("pkg0"), kind: "other" }],
      }),
    ).toStrictEqual([]);
  });
});

describe("contributorBadges tidier", () => {
  it("awards tidier at net 500 deleted code lines and withholds it at 499", () => {
    // each commit adds 1 line, so 501 deleted is a net of 500
    expect(kindsOf([commit(daysAgo(400), ["src/a.ts"], 501)])).toContain(
      "tidier",
    );
    expect(kindsOf([commit(daysAgo(400), ["src/a.ts"], 500)])).not.toContain(
      "tidier",
    );
  });

  it("counts code files only", () => {
    expect(kindsOf([commit(daysAgo(400), ["docs/a.md"], 900)])).not.toContain(
      "tidier",
    );
  });
});

describe("contributorBadges founder and keeper", () => {
  it("awards founder to the first author of 25 percent of today's files", () => {
    expect(
      contributorBadges(
        ada,
        facts(old(1), { founded: { files: 25, ofFiles: 100 } }),
      ),
    ).toStrictEqual([
      {
        kind: "founder",
        label: "Founder",
        evidence: "First author of 25% of today's files.",
      },
    ]);
    expect(
      kindsOf(old(1), { founded: { files: 24, ofFiles: 100 } }),
    ).not.toContain("founder");
  });

  it("awards keeper of the largest territory where the person is the only active expert", () => {
    const territories = [
      territory("small", 3),
      territory("large", 9),
      territory("shared", 12, [ada, "grace@example.com"]),
    ];

    expect(
      contributorBadges(ada, facts(old(1), { territories })),
    ).toContainEqual({
      kind: "keeper",
      label: "Keeper of large",
      evidence: "The only active expert of large.",
    });
  });

  it("calls the root territory the repository root", () => {
    const root = { ...territory("."), paths: ["a.ts", "b.ts"] };
    const keeper = contributorBadges(
      ada,
      facts(old(1), { territories: [root] }),
    ).find(({ kind }) => kind === "keeper");

    expect(keeper).toStrictEqual({
      kind: "keeper",
      label: "Keeper of the repository root",
      evidence: "The only active expert of the repository root.",
    });
  });

  it("withholds keeper when someone else is the only active expert or the territory is other files", () => {
    expect(
      kindsOf(old(1), {
        territories: [territory("pkg", 5, ["grace@example.com"])],
      }),
    ).not.toContain("keeper");
    expect(
      kindsOf(old(1), {
        territories: [{ ...territory("pkg"), kind: "other" }],
      }),
    ).not.toContain("keeper");
  });
});

describe("contributorBadges specialist of the root territory", () => {
  it("names the repository root rather than a dot", () => {
    const root = { ...territory("."), paths: ["a.ts", "b.ts"] };
    const commits = old(10).map((c) => commit(c.time, ["a.ts"]));

    expect(
      contributorBadges(ada, facts(commits, { territories: [root] })),
    ).toContainEqual({
      kind: "specialist",
      label: "The repository root specialist",
      evidence: "100% of the commits fall into the repository root.",
    });
  });
});

describe("contributorBadges in a solo repository", () => {
  const solo = { historyContributors: 1, territories: territories8 };

  it("withholds all-rounder and keeper from the only contributor of the history", () => {
    expect(kindsOf(touching(8), { ...solo })).not.toContain("all-rounder");
    expect(kindsOf(touching(8), { ...solo })).not.toContain("keeper");
    expect(kindsOf(touching(8), { ...solo, historyContributors: 2 })).toEqual(
      expect.arrayContaining(["all-rounder", "keeper"]),
    );
  });

  it("still awards the badges that compare with nobody", () => {
    expect(
      kindsOf([commit(daysAgo(30), ["src/a.ts"], 800)], solo),
    ).toStrictEqual(["tidier", "new-here"]);
  });
});

/** 10 commits, each changing one file: `matching` of them in `path`, the rest in src. */
const tenCommits = (matching: number, path: string) =>
  old(10).map((c, i) =>
    commit(c.time, [
      i < matching ? path.replace("X", String(i)) : `src/f${i}.ts`,
    ]),
  );

describe("contributorBadges tester and documenter", () => {
  it("awards tester when 40 percent of the changed files are tests", () => {
    expect(
      contributorBadges(ada, facts(tenCommits(4, "src/X.test.ts"))),
    ).toStrictEqual([
      {
        kind: "tester",
        label: "Tester",
        evidence: "40% of the changed files are tests.",
      },
    ]);
    expect(kindsOf(tenCommits(3, "src/X.test.ts"))).not.toContain("tester");
  });

  it("awards documenter when 40 percent of the commits touch documentation", () => {
    expect(
      contributorBadges(ada, facts(tenCommits(4, "docs/X.md"))),
    ).toStrictEqual([
      {
        kind: "documenter",
        label: "Documenter",
        evidence: "40% of the commits touch documentation.",
      },
    ]);
    expect(kindsOf(tenCommits(3, "docs/X.md"))).not.toContain("documenter");
  });

  it("needs 10 commits before a share counts", () => {
    const few = old(9).map((c) =>
      commit(c.time, ["docs/a.md", "src/a.test.ts"]),
    );

    expect(kindsOf(few)).toStrictEqual([]);
  });
});

// the six months back from 2026-07-01 are (06-01, 07-01], (05-01, 06-01], ... (01-01, 02-01]
const monthly = (...months: ReadonlyArray<string>) =>
  months.map((month) => commit(at(`2026-${month}-15T12:00:00Z`)));
const sixMonths = ["06", "05", "04", "03", "02", "01"];

describe("contributorBadges steady, new here and back again", () => {
  it("awards steady for a commit in each of the last 6 months", () => {
    expect(contributorBadges(ada, facts(monthly(...sixMonths)))).toContainEqual(
      {
        kind: "steady",
        label: "Steady",
        evidence: "A commit in each of the last 6 months.",
      },
    );
  });

  it("withholds steady when one of the last 6 months has no commit", () => {
    expect(kindsOf(monthly("06", "05", "04", "02", "01"))).not.toContain(
      "steady",
    );
  });

  it("awards new here to a first commit at most 90 days old, and withholds it at 91", () => {
    expect(contributorBadges(ada, facts([commit(daysAgo(90))]))).toStrictEqual([
      {
        kind: "new-here",
        label: "New here",
        evidence: "First commit on 2026-04-02, 90 days ago.",
      },
    ]);
    expect(kindsOf([commit(daysAgo(91))])).not.toContain("new-here");
  });

  it("judges the first commit of a person with hundreds of thousands of commits", () => {
    const many = Array.from({ length: 300_000 }, (_, i) =>
      commit(daysAgo(1 + (i % 60))),
    );

    expect(kindsOf(many)).toContain("new-here");
  });

  it("withholds new here from the one who started the repository", () => {
    const first = commit(daysAgo(30));

    expect(kindsOf([first], { repositoryStart: first.time })).not.toContain(
      "new-here",
    );
    expect(kindsOf([first], { repositoryStart: first.time - 1 })).toContain(
      "new-here",
    );
  });

  it("awards back again after a pause of 6 months that ended in the last 6 months", () => {
    const back = [commit(daysAgo(300)), commit(daysAgo(300 - 183))];

    expect(contributorBadges(ada, facts(back))).toStrictEqual([
      {
        kind: "back-again",
        label: "Back again",
        evidence: "Back on 2026-03-06 after 183 days without a commit.",
      },
    ]);
  });

  it("withholds back again after a pause of 182 days, or one that ended long ago", () => {
    expect(
      kindsOf([commit(daysAgo(300)), commit(daysAgo(300 - 182))]),
    ).not.toContain("back-again");
    expect(kindsOf([commit(daysAgo(900)), commit(daysAgo(600))])).not.toContain(
      "back-again",
    );
  });
});

describe("contributorBadges", () => {
  it("orders the badges by priority", () => {
    expect(
      kindsOf([commit(daysAgo(30), ["src/a.ts"], 800)], {
        founded: { files: 50, ofFiles: 100 },
      }),
    ).toStrictEqual(["tidier", "founder", "new-here"]);
  });

  it("awards nothing without commits", () => {
    expect(kindsOf([])).toStrictEqual([]);
  });
});

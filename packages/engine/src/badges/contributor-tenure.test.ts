import { describe, expect, it } from "vitest";

import { at } from "../testing/classified-commit.js";
import {
  ada,
  badgeFacts as facts,
  commit,
  daysAgo,
  kindsOf,
} from "../testing/contributor-badge-facts.js";
import { contributorBadges } from "./contributor-badges.js";

// the six months back from 2026-07-01 are (06-01, 07-01], (05-01, 06-01], ... (01-01, 02-01]
const monthly = (...months: ReadonlyArray<string>) =>
  months.map((month) => commit(at(`2026-${month}-15T12:00:00Z`)));
const sixMonths = ["06", "05", "04", "03", "02", "01"];

describe("tenure badges steady and new here", () => {
  it("awards steady for a commit in each of the last 6 months", () => {
    expect(contributorBadges(ada, facts(monthly(...sixMonths)))).toContainEqual(
      {
        kind: "steady",
        category: "journey",
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
        category: "journey",
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
});

describe("tenure badges back again", () => {
  it("awards back again after a pause of 6 months that ended in the last 6 months", () => {
    const back = [commit(daysAgo(300)), commit(daysAgo(300 - 183))];

    expect(contributorBadges(ada, facts(back))).toStrictEqual([
      {
        kind: "back-again",
        category: "journey",
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

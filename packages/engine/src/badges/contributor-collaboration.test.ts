import { describe, expect, it } from "vitest";

import {
  badgeFacts,
  commit,
  daysAgo,
  kindsOf,
} from "../testing/contributor-badge-facts.js";
import { contributorBadges } from "./contributor-badges.js";

const paired = (count: number, firstDaysAgo = 10) =>
  Array.from({ length: count }, (_, i) =>
    commit(daysAgo(firstDaysAgo + i), ["src/a.ts"], 0, { humanCoAuthors: 1 }),
  );

describe("contributorBadges pair partner", () => {
  it("awards it for 5 commits with a human co-author and says how many", () => {
    expect(
      contributorBadges("ada@example.com", badgeFacts(paired(5))),
    ).toContainEqual({
      kind: "pair-partner",
      category: "collaboration",
      label: "Pair partner",
      evidence: "5 commits in the last year with another person as co-author.",
    });
  });

  it("withholds it at 4 commits", () => {
    expect(kindsOf(paired(4))).not.toContain("pair-partner");
  });

  it("counts only the last year", () => {
    expect(kindsOf(paired(5, 366))).not.toContain("pair-partner");
    expect(kindsOf([...paired(3), ...paired(2, 370)])).not.toContain(
      "pair-partner",
    );
  });

  it("counts commits of a person helped by an agent as well", () => {
    const assisted = Array.from({ length: 5 }, (_, i) =>
      commit(daysAgo(10 + i), ["src/a.ts"], 0, {
        class: "agent-assisted",
        humanCoAuthors: 2,
      }),
    );

    expect(kindsOf(assisted)).toContain("pair-partner");
  });

  it("is not awarded for commits without a human co-author", () => {
    const solo = Array.from({ length: 20 }, (_, i) => commit(daysAgo(10 + i)));

    expect(kindsOf(solo)).not.toContain("pair-partner");
  });
});

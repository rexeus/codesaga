import { describe, expect, it } from "vitest";

import { ada, badgeFacts } from "../testing/contributor-badge-facts.js";
import {
  blob,
  change,
  commitOf,
  factsLookup,
  kinds,
} from "../testing/craft-commits.js";
import { contributorBadges } from "./contributor-badges.js";

/** A commit that adds an exported function to `src/m<day>.ts`, and `cases` test cases to its test. */
const adding = (day: number, cases: number) =>
  commitOf(day, [
    change(
      `src/m${day}.ts`,
      blob({ declarations: 1, exportedFunctions: 1 }),
      blob({ declarations: 0, exportedFunctions: 0 }),
    ),
    ...(cases === 0
      ? []
      : [
          change(
            `src/m${day}.test.ts`,
            blob({ testCases: cases }),
            blob({ testCases: 0 }),
          ),
        ]),
  ]);

/** `tested` commits that also add test cases, and `untested` that do not. */
const mix = (tested: number, untested: number) => [
  ...Array.from({ length: tested }, (_, i) => adding(1 + i, 2)),
  ...Array.from({ length: untested }, (_, i) => adding(30 + i, 0)),
];

describe("test-companion", () => {
  it("is awarded at 10 commits adding exported functions, half of them with test cases", () => {
    expect(
      contributorBadges(ada, badgeFacts(mix(5, 5), { factsLookup })),
    ).toContainEqual({
      kind: "test-companion",
      category: "craft",
      label: "Test companion",
      evidence:
        "50% of their commits in the last 365 days that add an exported function also add test cases (5 of 10).",
    });
  });

  it("is withheld just below half, and below 10 commits", () => {
    expect(kinds(mix(4, 6))).not.toContain("test-companion");
    expect(kinds(mix(9, 0))).not.toContain("test-companion");
  });

  it("does not count a commit that adds a private function beside an exported interface, as the digest says", () => {
    const hidden = Array.from({ length: 10 }, (_, i) =>
      commitOf(1 + i, [
        change(
          `src/h${i}.ts`,
          blob({ declarations: 1, exportedFunctions: 0 }),
          blob({ declarations: 0, exportedFunctions: 0 }),
        ),
        change(
          `src/h${i}.test.ts`,
          blob({ testCases: 1 }),
          blob({ testCases: 0 }),
        ),
      ]),
    );

    expect(kinds(hidden)).not.toContain("test-companion");
  });
});

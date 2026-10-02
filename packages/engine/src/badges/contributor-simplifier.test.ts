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

type Notable = ReadonlyArray<readonly [name: string, complexity: number]>;

/** `count` functions `f0`, `f1`, ... of `complexity`, starting at `first`. */
const functions = (count: number, complexity: number, first = 0): Notable =>
  Array.from({ length: count }, (_, index) => [
    `f${first + index}`,
    complexity,
  ]);

/** One commit that changes a file from `before` to `after` functions. */
const simplifying = (
  before: { count: number; notable: Notable },
  after: { count: number; notable: Notable },
) =>
  commitOf(1, [
    change(
      "src/a.ts",
      blob({ functions: after.count, notable: after.notable }),
      blob({ functions: before.count, notable: before.notable }),
    ),
  ]);

/** Ten functions of which five share the name `f10`. */
const twins = (complexity: number): Notable => [
  ...functions(5, complexity),
  ...functions(5, complexity, 10).map(([, value]): [string, number] => [
    "f10",
    value,
  ]),
];

const lowered = (count: number, from: number, to: number) =>
  simplifying(
    { count: 40, notable: functions(count, from) },
    { count: 40, notable: functions(count, to) },
  );

describe("simplifier", () => {
  it("is awarded at 10 functions lowered by 3, matched by name, with the count as evidence", () => {
    expect(
      contributorBadges(ada, badgeFacts([lowered(10, 8, 5)], { factsLookup })),
    ).toContainEqual({
      kind: "simplifier",
      category: "craft",
      label: "Simplifier",
      evidence:
        "Lowered the cognitive complexity of 10 functions by 3 or more in the last year, without adding functions to their files.",
    });
  });

  it("is withheld at 9 functions, or when they were lowered by only 2", () => {
    expect(kinds([lowered(9, 8, 5)])).not.toContain("simplifier");
    expect(kinds([lowered(10, 8, 6)])).not.toContain("simplifier");
  });

  it("counts a function that left the list of functions of 3 or more as lowered to 2, while the file kept its functions", () => {
    const vanished = simplifying(
      { count: 30, notable: functions(10, 5) },
      { count: 30, notable: [] },
    );

    expect(kinds([vanished])).toContain("simplifier");
  });

  it("does not count a vanished function when the file lost functions, or one that was 4 and is now 2", () => {
    const deleted = simplifying(
      { count: 30, notable: functions(10, 8) },
      { count: 20, notable: [] },
    );
    const nearly = simplifying(
      { count: 30, notable: functions(10, 4) },
      { count: 30, notable: [] },
    );

    expect(kinds([deleted])).not.toContain("simplifier");
    expect(kinds([nearly])).not.toContain("simplifier");
  });
});

describe("simplifier and a commit that adds functions or a cut list", () => {
  it("counts nothing for a file the commit adds functions to", () => {
    const adding = simplifying(
      { count: 40, notable: functions(10, 8) },
      { count: 41, notable: functions(10, 5) },
    );

    expect(kinds([adding])).not.toContain("simplifier");
  });

  it("counts nothing for a file whose list holds 40 functions in either version", () => {
    const cutBefore = simplifying(
      { count: 60, notable: functions(40, 8) },
      { count: 60, notable: functions(39, 4) },
    );
    const cutAfter = simplifying(
      { count: 60, notable: functions(39, 8) },
      { count: 60, notable: functions(40, 4) },
    );

    expect(kinds([cutBefore])).not.toContain("simplifier");
    expect(kinds([cutAfter])).not.toContain("simplifier");
  });

  it("does not match a name that two functions share", () => {
    const ambiguous = simplifying(
      { count: 30, notable: twins(8) },
      { count: 30, notable: twins(4) },
    );

    expect(kinds([ambiguous])).not.toContain("simplifier");
  });
});

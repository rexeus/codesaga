import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import {
  quietTerritory,
  repositoryCode,
} from "../testing/territory-badge-input.js";
import { churning, deeplyNested, heavyweight, hotspot } from "./code-badges.js";
import type { CodeFacts, SiblingFacts } from "./territory-badge-facts.js";
import { territoryBadges } from "./territory-badges.js";

const quiet = quietTerritory();

/** A tenth of the repository's files among ten siblings, unremarkable in every respect the badges compare. */
const territory = (
  code: Partial<CodeFacts>,
  siblings: Partial<SiblingFacts> = {},
) => ({
  code: { ...quiet.code, ...code },
  repository: repositoryCode,
  siblings: { ...quiet.siblings, ...siblings },
});

describe("heavyweight", () => {
  it("is earned by 20% of the repository's code lines and not by less", () => {
    expect(heavyweight(territory({ codeLines: 2_000 }))?.evidence).toBe(
      "Holds 20% of the repository's code lines. It holds 20% of the code lines among itself and 9 other territories.",
    );
    expect(heavyweight(territory({ codeLines: 1_999 }))).toBeUndefined();
  });

  it("is earned by a median file of 400 lines and not by 399", () => {
    // 10% of a larger repository, so only the long files count
    const large = { ...repositoryCode, codeLines: 20_000 };
    const outweighing = { codeLines: 2_000 };

    expect(
      heavyweight({
        ...territory({ ...outweighing, medianFileLines: 400 }),
        repository: large,
      })?.evidence,
    ).toBe(
      "The median file has 400 lines. It holds 20% of the code lines among itself and 9 other territories.",
    );
    expect(
      heavyweight({
        ...territory({ ...outweighing, medianFileLines: 399 }),
        repository: large,
      }),
    ).toBeUndefined();
  });

  it("gives both reasons when both hold", () => {
    expect(
      heavyweight(territory({ codeLines: 3_000, medianFileLines: 450 }))
        ?.evidence,
    ).toBe(
      "Holds 30% of the repository's code lines. The median file has 450 lines. It holds 30% of the code lines among itself and 9 other territories.",
    );
  });
});

describe("heavyweight among siblings", () => {
  it("needs twice the fair share among its siblings, not only the repository share", () => {
    // 4 siblings hold 5,000 lines: the fair share is 25%, twice that is 50% or 2,500 lines
    const four = { count: 4, codeLines: 5_000 };

    expect(heavyweight(territory({ codeLines: 2_500 }, four))).toBeDefined();
    expect(heavyweight(territory({ codeLines: 2_499 }, four))).toBeUndefined();
  });

  it("needs at least three territories at its level", () => {
    const share = { codeLines: 2_500 };

    expect(
      heavyweight(territory(share, { count: 3, codeLines: 3_000 })),
    ).toBeDefined();
    expect(
      heavyweight(territory(share, { count: 2, codeLines: 2_500 })),
    ).toBeUndefined();
  });

  it("does not badge a territory that is big among its siblings but small in the repository", () => {
    // 75% of the code lines of three siblings, but 15% of the repository and a median file of 100 lines
    expect(
      heavyweight(
        territory({ codeLines: 1_500 }, { count: 3, codeLines: 2_000 }),
      ),
    ).toBeUndefined();
  });

  it("has no share to judge in a repository without code lines", () => {
    expect(
      heavyweight({
        code: { ...quiet.code, codeLines: 0 },
        repository: { ...repositoryCode, codeLines: 0 },
        siblings: {
          ...quiet.siblings,
          count: 3,
          codeLines: 0,
          revisionLines: 0,
        },
      }),
    ).toBeUndefined();
  });
});

describe("hotspot", () => {
  it("is earned by 25% of the repository's revisions times lines and not by less", () => {
    expect(hotspot(territory({ revisionLines: 5_000 }))?.evidence).toBe(
      "25% of the repository's revisions times lines sit here, the hotspot measure of codeheat, and 25% among itself and 9 other territories.",
    );
    expect(hotspot(territory({ revisionLines: 4_999 }))).toBeUndefined();
  });

  it("needs twice the fair share among its siblings", () => {
    // 5 siblings hold 10,000: the fair share is 20%, twice that is 40% or 4,000, and 25% of the repository is 5,000
    const five = { count: 5, revisionLines: 10_000 };

    expect(hotspot(territory({ revisionLines: 5_000 }, five))).toBeDefined();
    // 25% of the repository but only 2,000 of 6,000 (33%) among 4 siblings, whose fair share doubles to 50%
    expect(
      hotspot(
        territory(
          { revisionLines: 5_000 },
          { count: 4, revisionLines: 10_001 },
        ),
      ),
    ).toBeUndefined();
  });

  it("needs at least three territories at its level", () => {
    expect(
      hotspot(
        territory({ revisionLines: 5_000 }, { count: 3, revisionLines: 7_000 }),
      ),
    ).toBeDefined();
    expect(
      hotspot(
        territory({ revisionLines: 5_000 }, { count: 2, revisionLines: 5_000 }),
      ),
    ).toBeUndefined();
  });
});

describe("churning", () => {
  it("needs a median of 5 revisions when the repository's median is low", () => {
    expect(churning(territory({ medianRevisions: 5 }))?.evidence).toBe(
      "The median file changed 5 times, the repository's 2; among itself and 9 other territories the median is 2.",
    );
    expect(churning(territory({ medianRevisions: 4.9 }))).toBeUndefined();
  });

  it("needs 1.5 times a high repository median", () => {
    const busy = { ...repositoryCode, medianRevisions: 6 };

    expect(
      churning({ ...territory({ medianRevisions: 9 }), repository: busy }),
    ).toBeDefined();
    expect(
      churning({ ...territory({ medianRevisions: 8.9 }), repository: busy }),
    ).toBeUndefined();
  });
});

describe("churning among siblings", () => {
  it("needs 1.5 times the median of its siblings, not only the repository's median", () => {
    // 6 revisions against a sibling median of 4 is 1.5 times, and 5.9 is not
    expect(
      churning(territory({ medianRevisions: 6 }, { medianRevisions: 4 })),
    ).toBeDefined();
    expect(
      churning(territory({ medianRevisions: 5.9 }, { medianRevisions: 4 })),
    ).toBeUndefined();
  });

  it("needs at least three territories at its level", () => {
    expect(
      churning(territory({ medianRevisions: 6 }, { count: 3 })),
    ).toBeDefined();
    expect(
      churning(territory({ medianRevisions: 6 }, { count: 2 })),
    ).toBeUndefined();
  });
});

describe("deeplyNested", () => {
  it("needs 1.0 levels per line when the repository is flat", () => {
    expect(deeplyNested(territory({ complexityPerLine: 1 }))?.evidence).toBe(
      "1.00 indentation levels per line, the repository's 0.50; among itself and 9 other territories the median is 0.50.",
    );
    expect(
      deeplyNested(territory({ complexityPerLine: 0.99 })),
    ).toBeUndefined();
  });

  it("needs 1.4 times the levels of a nested repository", () => {
    const nested = { ...repositoryCode, complexityPerLine: 1.5 };

    expect(
      deeplyNested({
        ...territory({ complexityPerLine: 2.1 }),
        repository: nested,
      }),
    ).toBeDefined();
    expect(
      deeplyNested({
        ...territory({ complexityPerLine: 2.09 }),
        repository: nested,
      }),
    ).toBeUndefined();
  });
});

describe("deeplyNested among siblings", () => {
  it("needs 1.5 times the median of its siblings, not only the repository's levels", () => {
    // 1.5 levels against a sibling median of 1 is 1.5 times, and 1.49 is not
    expect(
      deeplyNested(
        territory({ complexityPerLine: 1.5 }, { complexityPerLine: 1 }),
      ),
    ).toBeDefined();
    expect(
      deeplyNested(
        territory({ complexityPerLine: 1.49 }, { complexityPerLine: 1 }),
      ),
    ).toBeUndefined();
  });

  it("needs at least three territories at its level", () => {
    expect(
      deeplyNested(territory({ complexityPerLine: 1.5 }, { count: 3 })),
    ).toBeDefined();
    expect(
      deeplyNested(territory({ complexityPerLine: 1.5 }, { count: 2 })),
    ).toBeUndefined();
  });
});

describe("territoryBadges code badges", () => {
  it("files them under code, after the activity badges and before well tested", () => {
    const badges = territoryBadges(
      quietTerritory({
        paths: Array.from({ length: 10 }, (_, i) => `packages/a/f${i}.test.ts`),
        lastChangeTime: 0,
        code: {
          files: 10,
          codeLines: 5_000,
          medianFileLines: 500,
          medianRevisions: 8,
          revisionLines: 10_000,
          complexityPerLine: 2,
        },
      }),
      DateTime.makeUnsafe("2026-07-01T00:00:00Z"),
    );

    expect(badges.map(({ kind, category }) => [kind, category])).toStrictEqual([
      ["quiet", "activity"],
      ["heavyweight", "code"],
      ["hotspot", "code"],
      ["churning", "code"],
      ["deeply-nested", "code"],
      ["well-tested", "code"],
    ]);
  });
});

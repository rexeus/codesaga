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

/** `count` commits that each remove `each` explicit `any` from a file of 60. */
const tightening = (count: number, each: number, base = 1) =>
  Array.from({ length: count }, (_, index) =>
    commitOf(base + index, [
      change(
        "src/a.ts",
        blob({ any: 60 - (index + 1) * each }),
        blob({ any: 60 - index * each }),
      ),
    ]),
  );

describe("type-tightener", () => {
  it("is awarded at 20 explicit any removed in 8 commits, with the removals as evidence", () => {
    const badges = contributorBadges(
      ada,
      badgeFacts(tightening(8, 3), { factsLookup }),
    );

    expect(badges).toContainEqual({
      kind: "type-tightener",
      category: "craft",
      label: "Type tightener",
      evidence:
        "Removed 24 explicit any in the last 365 days, in 8 commits that each removed some.",
    });
  });

  it("is withheld just below 20 any or below 8 commits", () => {
    expect(kinds(tightening(8, 2))).not.toContain("type-tightener");
    expect(kinds(tightening(7, 3))).not.toContain("type-tightener");
  });

  it("does not count a commit that net adds any, and counts a move between files as nothing", () => {
    const moved = commitOf(30, [
      change("src/a.ts", blob({ any: 0 }), blob({ any: 9 })),
      change("src/b.ts", blob({ any: 9 }), blob({ any: 0 })),
    ]);

    expect(kinds([...tightening(7, 3), moved])).not.toContain("type-tightener");
  });

  it("ignores agent-assisted commits and commits that change more than 50 files", () => {
    const assisted = tightening(8, 3).map((own) =>
      Object.assign({}, own, { class: "agent-assisted" as const }),
    );
    const mass = tightening(8, 3).map((own) =>
      Object.assign({}, own, {
        changes: own.changes.concat(
          Array.from({ length: 50 }, (_, i) => change(`docs/${i}.md`, "x")),
        ),
        changedFiles: 51,
      }),
    );

    expect(kinds(assisted)).not.toContain("type-tightener");
    expect(kinds(mass)).not.toContain("type-tightener");
  });
});

describe("type-tightener and the analysis scope", () => {
  it("applies the 50-file limit to the files a commit changed in the whole repository, not to the scoped ones", () => {
    const scoped = tightening(8, 3).map((own) =>
      Object.assign({}, own, { changedFiles: 51 }),
    );
    const within = tightening(8, 3).map((own) =>
      Object.assign({}, own, { changedFiles: 50 }),
    );

    expect(kinds(scoped)).not.toContain("type-tightener");
    expect(kinds(within)).toContain("type-tightener");
  });
});

describe("type-tightener and the clock", () => {
  it("reads only the last 365 days", () => {
    const old = tightening(8, 3, 366);

    expect(kinds(old)).not.toContain("type-tightener");
    expect(kinds([...tightening(4, 3, 360), ...tightening(4, 3, 1)])).toContain(
      "type-tightener",
    );
  });

  it("is withheld when the history's facts were not read", () => {
    expect(
      contributorBadges(ada, badgeFacts(tightening(8, 3))).map(
        ({ kind }) => kind,
      ),
    ).not.toContain("type-tightener");
  });
});

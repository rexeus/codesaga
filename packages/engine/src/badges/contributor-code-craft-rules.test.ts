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

/** A commit that deletes `count` top-level functions from `path`, which had 30. */
const deleting = (day: number, count: number, path = "src/a.ts") =>
  commitOf(day, [
    change(
      path,
      blob({ declarations: 30 - count }),
      blob({ declarations: 30 }),
    ),
  ]);

describe("sweeper", () => {
  it("is awarded at 15 declarations net removed, with the count as evidence", () => {
    const commits = [deleting(1, 10), deleting(2, 5)];

    expect(
      contributorBadges(ada, badgeFacts(commits, { factsLookup })),
    ).toContainEqual({
      kind: "sweeper",
      category: "craft",
      label: "Sweeper",
      evidence:
        "Removed 15 more top-level functions, classes and arrow-function constants than added in the last 365 days.",
    });
  });

  it("is withheld at 14, and a commit that adds declarations takes from the net", () => {
    const adding = commitOf(3, [
      change("src/b.ts", blob({ declarations: 5 }), blob({ declarations: 0 })),
    ]);

    expect(kinds([deleting(1, 14)])).not.toContain("sweeper");
    expect(kinds([deleting(1, 10), deleting(2, 10), adding])).toContain(
      "sweeper",
    );
    expect(kinds([deleting(1, 10), deleting(2, 7), adding])).not.toContain(
      "sweeper",
    );
  });

  it("does not count a function moved to another file", () => {
    const moved = commitOf(1, [
      change("src/a.ts", blob({ declarations: 5 }), blob({ declarations: 20 })),
      change("src/b.ts", blob({ declarations: 20 }), blob({ declarations: 5 })),
    ]);

    expect(kinds([moved])).not.toContain("sweeper");
  });

  it("ignores a commit of 60 files", () => {
    const mass = commitOf(1, [
      deleting(1, 20).changes[0] ?? change("src/a.ts", "x"),
      ...Array.from({ length: 59 }, (_, i) => change(`docs/${i}.md`, "x")),
    ]);

    expect(kinds([mass])).not.toContain("sweeper");
  });
});

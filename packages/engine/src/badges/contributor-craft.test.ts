import { describe, expect, it } from "vitest";

import {
  badgeFacts,
  commit,
  daysAgo,
  kindsOf,
} from "../testing/contributor-badge-facts.js";
import { contributorBadges } from "./contributor-badges.js";

const CI = [".github/workflows/ci.yml"];
const SOURCE = ["src/a.ts"];

/** `tooling` commits that change only `paths` and `others` that change source, all in the last month. */
const mix = (tooling: number, others: number, paths = CI) => [
  ...Array.from({ length: tooling }, (_, i) => commit(daysAgo(1 + i), paths)),
  ...Array.from({ length: others }, (_, i) => commit(daysAgo(11 + i), SOURCE)),
];

describe("contributorBadges toolsmith", () => {
  it("awards it at 30% of the commits changing only tooling, and says how many", () => {
    expect(
      contributorBadges("ada@example.com", badgeFacts(mix(3, 7))),
    ).toContainEqual({
      kind: "toolsmith",
      category: "craft",
      label: "Toolsmith",
      evidence:
        "30% of their commits in the last year change only tooling files, such as CI, containers, manifests and configuration (3 of 10).",
    });
  });

  it("withholds it just below 30%", () => {
    expect(kindsOf(mix(2, 8))).not.toContain("toolsmith");
  });

  it("needs 10 commits that change files before a share counts", () => {
    expect(kindsOf(mix(9, 0))).not.toContain("toolsmith");
    expect(kindsOf(mix(10, 0))).toContain("toolsmith");
  });

  it("counts a commit only when every path it changes is tooling", () => {
    const mixed = Array.from({ length: 10 }, (_, i) =>
      commit(daysAgo(1 + i), [...CI, ...SOURCE]),
    );

    expect(kindsOf(mixed)).not.toContain("toolsmith");
  });

  it("counts manifests, lockfiles and configuration as tooling", () => {
    const paths = [
      "packages/a/package.json",
      "pnpm-lock.yaml",
      "vite.config.ts",
    ];

    expect(kindsOf(mix(10, 0, paths))).toContain("toolsmith");
  });

  it("ignores commits without changes", () => {
    const empty = Array.from({ length: 20 }, (_, i) =>
      commit(daysAgo(1 + i), []),
    );

    expect(kindsOf([...mix(9, 0), ...empty])).not.toContain("toolsmith");
  });

  it("reads human commits of the last year only", () => {
    const assisted = Array.from({ length: 10 }, (_, i) =>
      commit(daysAgo(1 + i), CI, 0, { class: "agent-assisted" }),
    );
    const longAgo = Array.from({ length: 10 }, (_, i) =>
      commit(daysAgo(400 + i), CI),
    );

    expect(kindsOf([...assisted, ...mix(0, 10)])).not.toContain("toolsmith");
    expect(kindsOf([...longAgo, ...mix(0, 10)])).not.toContain("toolsmith");
  });
});

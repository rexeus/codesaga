import { describe, expect, it } from "vitest";

import { SIGNATURES } from "../automation/signatures.js";
import { lineOwnersOf } from "./line-owners.js";
import type { Ownership } from "./line-owners.js";

const ownership: Ownership = {
  files: new Map([
    [
      "src/a.ts",
      new Map([
        ["ada@example.com", { name: "Ada", lines: 6 }],
        ["grace@example.com", { name: "grace", lines: 2 }],
        ["dependabot@example.com", { name: "Dependabot", lines: 2 }],
      ]),
    ],
    [
      "src/b.ts",
      new Map([
        ["ada@example.com", { name: "Ada", lines: 1 }],
        ["grace@example.com", { name: "grace", lines: 3 }],
      ]),
    ],
    ["docs/c.ts", new Map([["ada@example.com", { name: "Ada", lines: 100 }]])],
  ]),
  failed: new Set(),
  signatures: SIGNATURES,
  identities: new Map([
    ["grace@example.com", { name: "Grace Hopper" }],
    ["dependabot@example.com", { name: "dependabot[bot]" }],
  ]),
};

describe("lineOwnersOf", () => {
  it("adds up the files of the set, with each author's share of all its lines", () => {
    // ada 6 + 1, grace 2 + 3, bot 2: 14 lines.
    expect(lineOwnersOf(["src/a.ts", "src/b.ts"], ownership)).toStrictEqual({
      skippedFiles: 0,
      lines: 14,
      owners: [
        {
          name: "Ada",
          email: "ada@example.com",
          lines: 7,
          share: 0.5,
          kind: "human",
        },
        {
          name: "Grace Hopper",
          email: "grace@example.com",
          lines: 5,
          share: 0.3571,
          kind: "human",
        },
        {
          name: "dependabot[bot]",
          email: "dependabot@example.com",
          lines: 2,
          share: 0.1429,
          kind: "bot",
        },
      ],
    });
  });
});

describe("lineOwnersOf kinds", () => {
  it("marks an account of the config's signatures as a bot", () => {
    const owned: Ownership = {
      files: new Map([
        ["x.ts", new Map([["ci@acme.example", { name: "Acme CI", lines: 2 }]])],
      ]),
      failed: new Set(),
      signatures: [
        ...SIGNATURES,
        {
          name: "Acme CI",
          kind: "bot",
          people: [{ email: "ci@acme.example" }],
        },
      ],
      identities: new Map(),
    };

    expect(lineOwnersOf(["x.ts"], owned).owners[0]?.kind).toBe("bot");
    expect(
      lineOwnersOf(["x.ts"], { ...owned, signatures: SIGNATURES }).owners[0]
        ?.kind,
    ).toBe("human");
  });

  it("marks an agent account as an agent", () => {
    const agent: Ownership = {
      files: new Map([
        [
          "x.ts",
          new Map([["noreply@anthropic.com", { name: "Claude", lines: 4 }]]),
        ],
      ]),
      failed: new Set(),
      signatures: SIGNATURES,
      identities: new Map(),
    };

    expect(lineOwnersOf(["x.ts"], agent).owners[0]).toMatchObject({
      share: 1,
      kind: "agent",
    });
  });
});

describe("lineOwnersOf limits and ties", () => {
  it("keeps the five largest owners and the lines of everyone", () => {
    const crowd: Ownership = {
      files: new Map([
        [
          "x.ts",
          new Map(
            [10, 9, 8, 7, 6, 5, 4].map((lines, index) => [
              `p${index}@example.com`,
              { name: `P${index}`, lines },
            ]),
          ),
        ],
      ]),
      failed: new Set(),
      signatures: SIGNATURES,
      identities: new Map(),
    };

    const { lines, owners } = lineOwnersOf(["x.ts"], crowd);

    expect(lines).toBe(49);
    expect(owners.map((owner) => owner.lines)).toStrictEqual([10, 9, 8, 7, 6]);
  });

  it("orders equal line counts by name and counts a path without blame as no lines", () => {
    const tied: Ownership = {
      files: new Map([
        [
          "x.ts",
          new Map([
            ["b@example.com", { name: "Bea", lines: 3 }],
            ["a@example.com", { name: "Abe", lines: 3 }],
          ]),
        ],
      ]),
      failed: new Set(),
      signatures: SIGNATURES,
      identities: new Map(),
    };

    const result = lineOwnersOf(["x.ts", "skipped.ts"], tied);

    expect(result.owners.map(({ name }) => name)).toStrictEqual(["Abe", "Bea"]);
    expect(lineOwnersOf(["skipped.ts"], tied)).toStrictEqual({
      skippedFiles: 0,
      lines: 0,
      owners: [],
    });
  });

  it("counts the paths of the set whose blame failed, and only those", () => {
    const withFailures: Ownership = {
      ...ownership,
      failed: new Set(["src/broken.ts", "elsewhere.ts"]),
    };

    expect(
      lineOwnersOf(["src/a.ts", "src/broken.ts"], withFailures).skippedFiles,
    ).toBe(1);
    expect(lineOwnersOf(["src/a.ts"], withFailures).skippedFiles).toBe(0);
  });
});

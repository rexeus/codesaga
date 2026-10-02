import { describe, expect, it } from "vitest";

import type { ClassifiedCommit } from "../automation/classify.js";
import { at, classifiedCommit } from "../testing/classified-commit.js";
import { commitsAt, highlightFacts } from "../testing/highlight-facts.js";
import { highlights } from "./highlights.js";

const ada = { name: "Ada", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };
const linus = { name: "Linus", email: "linus@example.com" };

/**
 * A history that passes eight thresholds: an anniversary, a 7-day streak,
 * 5 commits on one day, 2 newcomers, a cleanup, a quiet area, an orphaned area
 * and a truck factor of 1 with several contributors.
 */
const richCommits = (): ReadonlyArray<ClassifiedCommit> => [
  classifiedCommit({
    time: at("2021-07-04T10:00:00Z"),
    changes: [{ path: "old/a.ts", added: 5, deleted: 0 }],
  }),
  ...commitsAt([
    ...Array.from({ length: 7 }, (_, i) => `2026-06-${10 + i}T12:00:00Z`),
    ...Array.from({ length: 4 }, () => "2026-06-16T13:00:00Z"),
  ]),
  ...commitsAt(["2026-06-20T12:00:00Z"], { author: grace }),
  ...commitsAt(["2026-06-21T12:00:00Z"], { author: linus }),
  classifiedCommit({
    time: at("2026-06-25T12:00:00Z"),
    changes: [{ path: "src/big.ts", added: 0, deleted: 300 }],
  }),
];

const richFacts = () =>
  highlightFacts({
    commits: richCommits(),
    knowledge: {
      files: 20,
      truckFactor: {
        value: 1,
        people: [
          { ...ada, active: true, lastCommitAt: "2026-06-25T12:00:00.000Z" },
        ],
      },
    },
    areas: [
      {
        path: "legacy",
        kind: "package",
        paths: ["legacy/a.ts"],
        orphaned: true,
        withoutActiveExpert: 1,
        lastChangeTime: at("2026-06-25T12:00:00Z"),
      },
      {
        path: "old",
        kind: "directory",
        paths: ["old/a.ts"],
        orphaned: false,
        withoutActiveExpert: 0,
        lastChangeTime: at("2021-07-04T10:00:00Z"),
      },
    ],
  });

describe("highlights", () => {
  it("returns an empty list for a repository where nothing passes a threshold", () => {
    expect(
      highlights(
        highlightFacts({ commits: commitsAt(["2026-06-01T12:00:00Z"]) }),
      ),
    ).toStrictEqual([]);
  });

  it("ranks the findings of all families by fixed priority and keeps six", () => {
    expect(highlights(richFacts()).map(({ kind }) => kind)).toStrictEqual([
      "truck-factor-alert",
      "orphaned-knowledge",
      "anniversary",
      "streak",
      "busiest-day",
      "newcomers",
    ]);
  });

  it("falls back to the lower kinds when the higher ones are absent", () => {
    const facts = { ...richFacts(), areas: [] };

    const kinds = highlights({
      ...facts,
      knowledge: { files: 20, truckFactor: { value: 3, people: [] } },
    }).map(({ kind }) => kind);

    expect(kinds).toStrictEqual([
      "anniversary",
      "streak",
      "busiest-day",
      "newcomers",
      "biggest-cleanup",
    ]);
  });

  it("returns the same list for the same facts", () => {
    expect(highlights(richFacts())).toStrictEqual(highlights(richFacts()));
  });
});

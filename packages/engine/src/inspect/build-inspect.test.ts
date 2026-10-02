import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import type { RepositoryFacts } from "../analyze/gather.js";
import { SIGNATURES } from "../automation/signatures.js";
import type { HistoryCommit } from "../history/history.js";
import { at } from "../testing/classified-commit.js";
import { inventoryFile, linesOf } from "../testing/inventory-file.js";
import { buildInspectResult } from "./build-inspect.js";

const ada = { name: "Ada", email: "ada@example.com" };
const newest = at("2026-03-01T00:00:00Z");

/** `count` commits to src/a.ts, newest first, one minute apart. */
const commitsTouchingA = (count: number): ReadonlyArray<HistoryCommit> =>
  Array.from({ length: count }, (_, index) => ({
    sha: String(index),
    parents: [String(index + 1)],
    time: newest - index * 60,
    committerTime: newest - index * 60,
    offsetMinutes: 0,
    author: ada,
    committer: ada,
    subject: "",
    trailers: [],
    markers: [],
    changes: [{ path: "src/a.ts", added: 1, deleted: 0 }],
  }));

const factsOf = (commits: ReadonlyArray<HistoryCommit>): RepositoryFacts => ({
  root: "/repo",
  toolVersion: "0.0.0",
  now: DateTime.makeUnsafe("2026-03-10T00:00:00Z"),
  since: undefined,
  previous: undefined,
  repository: {
    name: "repo",
    head: "abc",
    branch: "main",
    scope: ".",
    shallow: false,
  },
  commits,
  headTime: commits[0]?.time ?? 0,
  universe: [inventoryFile("src/a.ts", linesOf(10))],
  packageRoots: [],
  detail: undefined,
  blame: undefined,
  isCodePath: () => true,
  signatures: SIGNATURES,
});

describe("buildInspectResult", () => {
  it("dates the last commit of a file with a very long history", () => {
    const { matches } = buildInspectResult(factsOf(commitsTouchingA(200_000)), [
      "src/a.ts",
    ]);

    expect(matches[0]).toMatchObject({
      commits: 200_000,
      lastCommitAt: "2026-03-01T00:00:00.000Z",
    });
  });
});

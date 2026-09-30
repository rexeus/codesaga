import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import type { RepositoryFacts } from "../analyze/gather.js";
import type { HistoryCommit } from "../history/history.js";
import { at } from "../testing/classified-commit.js";
import { buildInspectResult } from "./build-inspect.js";

const ada = { name: "Ada", email: "ada@example.com" };
const newest = at("2026-03-01T00:00:00Z");

/** `count` commits to src/a.ts, newest first, one minute apart. */
const commitsTouchingA = (count: number): ReadonlyArray<HistoryCommit> =>
  Array.from({ length: count }, (_, index) => ({
    sha: String(index),
    time: newest - index * 60,
    committerTime: newest - index * 60,
    offsetMinutes: 0,
    author: ada,
    committer: ada,
    trailers: [],
    markers: [],
    changes: [{ path: "src/a.ts", added: 1, deleted: 0 }],
  }));

const factsOf = (commits: ReadonlyArray<HistoryCommit>): RepositoryFacts => ({
  toolVersion: "0.0.0",
  now: DateTime.makeUnsafe("2026-03-10T00:00:00Z"),
  since: undefined,
  repository: {
    name: "repo",
    head: "abc",
    branch: "main",
    scope: ".",
    shallow: false,
  },
  commits,
  universe: [{ path: "src/a.ts", loc: 10 }],
  isCodePath: () => true,
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

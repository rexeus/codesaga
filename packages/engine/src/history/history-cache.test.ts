import { NodeServices } from "@effect/platform-node";
import { assert, describe, it, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { TestClock } from "effect/testing";

import { cacheStatus, loadCache, storeCache } from "./history-cache.js";
import type { HistoryCache } from "./history-cache.js";
import type { Commit } from "./parse-log.js";

const commit: Commit = {
  sha: "a".repeat(40),
  parents: ["c".repeat(40), "d".repeat(40)],
  time: 1_772_366_400,
  committerTime: 1_772_366_500,
  offsetMinutes: -330,
  author: { name: "Ada Lovelace", email: "ada@example.com" },
  committer: { name: "GitHub", email: "noreply@github.com" },
  subject: "Add the new module",
  trailers: [
    { key: "Co-Authored-By", value: "Claude <noreply@anthropic.com>" },
  ],
  markers: ["Generated with [Claude Code](https://claude.com/claude-code)"],
  changes: [
    {
      path: "src/new.ts",
      renamedFrom: "src/old.ts",
      added: 1,
      deleted: 2,
      oid: "1".repeat(40),
      previousOid: "2".repeat(40),
      mode: "100644",
      previousMode: "100755",
    },
    {
      path: "src/gone.ts",
      removed: true,
      added: 0,
      deleted: 9,
      previousOid: "3".repeat(40),
    },
    { path: "src/plain.ts", added: 3, deleted: 0 },
  ],
};

const cache: HistoryCache = {
  head: commit.sha,
  fingerprint: "fingerprint",
  // Git prints a date it cannot read as nothing, which the parser reads as NaN.
  commits: [
    commit,
    {
      ...commit,
      sha: "b".repeat(40),
      parents: [],
      time: NaN,
      committerTime: NaN,
      changes: [],
    },
  ],
};

layer(NodeServices.layer)("the history cache file", (effectIt) => {
  effectIt.effect(
    "returns the commits it stored, NaN times and optional fields included",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "codesaga-cache-",
        });
        const file = path.join(directory, "nested", "history-v2.json");

        yield* storeCache(file, cache);
        const loaded = yield* loadCache(file);

        assert.deepStrictEqual(loaded, cache);
        assert.deepStrictEqual(yield* fs.readDirectory(path.dirname(file)), [
          "history-v2.json",
        ]);
      }),
  );

  effectIt.effect("has nothing to return for a file that does not exist", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = yield* fs.makeTempDirectoryScoped({
        prefix: "codesaga-cache-",
      });

      assert.isUndefined(
        yield* loadCache(path.join(directory, "missing.json")),
      );
    }),
  );
});

layer(NodeServices.layer)("storing the history cache", (effectIt) => {
  effectIt.effect(
    "removes temporary files of dead runs older than an hour and keeps younger ones",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "codesaga-cache-",
        });
        const file = path.join(directory, "history-v2.json");
        const now = Date.parse("2026-03-10T12:00:00Z");
        yield* TestClock.setTime(now);
        const hourAgo = now - 60 * 60 * 1000;
        const write = (name: string, modified: number) =>
          fs
            .writeFileString(path.join(directory, name), "")
            .pipe(
              Effect.andThen(
                fs.utimes(
                  path.join(directory, name),
                  new Date(modified),
                  new Date(modified),
                ),
              ),
            );
        yield* write("history-v2.json.dead.tmp", hourAgo - 60_000);
        yield* write("history-v2.json.running.tmp", hourAgo + 60_000);
        yield* write("unrelated.tmp", hourAgo - 60_000);

        yield* storeCache(file, cache);

        assert.deepStrictEqual(
          (yield* fs.readDirectory(directory)).toSorted(),
          ["history-v2.json", "history-v2.json.running.tmp", "unrelated.tmp"],
        );
      }),
  );
});

describe("cacheStatus", () => {
  const now = { head: cache.head, fingerprint: cache.fingerprint };

  it("calls a cache of the same head and settings current", () => {
    assert.strictEqual(cacheStatus(cache, now), "current");
  });

  it("calls a cache of another head, written under the same settings, moved", () => {
    assert.strictEqual(
      cacheStatus(cache, { ...now, head: "c".repeat(40) }),
      "moved",
    );
  });

  it("calls a cache written under other settings stale, even for the same head", () => {
    assert.strictEqual(
      cacheStatus(cache, { ...now, fingerprint: "other" }),
      "stale",
    );
  });
});

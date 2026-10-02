import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

import { loadFactsCache, storeFactsCache } from "./facts-cache.js";
import type { FactsResult } from "./facts-of-source.js";

const skipped: FactsResult = { kind: "skipped", reason: "syntax-error" };

const temporaryDirectory = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "codesaga-" });
  return `${directory}/syntax-v1`;
});

const none = new Map<string, FactsResult>();
const key = (digit: string, tail = "ts:module") =>
  `${digit.repeat(40)}:${tail}`;

layer(NodeServices.layer)("the facts cache directory", (it) => {
  it.effect("returns the verdicts it stored under the same fingerprint", () =>
    Effect.gen(function* () {
      const directory = yield* temporaryDirectory;

      yield* storeFactsCache(
        directory,
        "fingerprint",
        new Map([[key("a"), skipped]]),
        none,
      );

      assert.deepStrictEqual(
        [...(yield* loadFactsCache(directory, "fingerprint"))],
        [[key("a"), skipped]],
      );
    }),
  );

  it.effect("returns nothing under another fingerprint", () =>
    Effect.gen(function* () {
      const directory = yield* temporaryDirectory;
      yield* storeFactsCache(
        directory,
        "old",
        new Map([[key("a"), skipped]]),
        none,
      );

      assert.strictEqual((yield* loadFactsCache(directory, "new")).size, 0);
    }),
  );
});

layer(NodeServices.layer)("reading a damaged facts cache directory", (it) => {
  it.effect("returns nothing for a missing directory or a damaged shard", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* temporaryDirectory;
      assert.strictEqual((yield* loadFactsCache(directory, "f")).size, 0);

      yield* fs.makeDirectory(directory, { recursive: true });
      yield* fs.writeFileString(
        `${directory}/aa.json`,
        '{"version":1,"fingerpr',
      );

      assert.strictEqual((yield* loadFactsCache(directory, "f")).size, 0);
    }),
  );

  it.effect(
    "leaves out an entry that is neither facts of this version nor a skip",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* temporaryDirectory;
        yield* fs.makeDirectory(directory, { recursive: true });
        yield* fs.writeFileString(
          `${directory}/aa.json`,
          JSON.stringify({
            version: 1,
            fingerprint: "f",
            facts: {
              old: { version: 0 },
              odd: { skipped: "nonsense" },
              bare: 7,
            },
          }),
        );

        assert.strictEqual((yield* loadFactsCache(directory, "f")).size, 0);
      }),
  );
});

layer(NodeServices.layer)("storing the facts cache shards", (it) => {
  it.effect(
    "writes one shard per first byte and only the shards that changed",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* temporaryDirectory;
        const first = new Map([
          [key("a"), skipped],
          [key("b"), skipped],
        ]);
        yield* storeFactsCache(directory, "f", first, none);
        yield* fs.writeFileString(`${directory}/bb.json`, "marker");

        yield* storeFactsCache(
          directory,
          "f",
          new Map([...first, [key("c"), skipped]]),
          first,
        );

        assert.deepStrictEqual(
          (yield* fs.readDirectory(directory)).toSorted(),
          ["aa.json", "bb.json", "cc.json"],
        );
        assert.strictEqual(
          yield* fs.readFileString(`${directory}/bb.json`),
          "marker",
        );
      }),
  );

  it.effect("removes a shard that no entry is left in", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* temporaryDirectory;
      const both = new Map([
        [key("a"), skipped],
        [key("b"), skipped],
      ]);
      yield* storeFactsCache(directory, "f", both, none);

      yield* storeFactsCache(
        directory,
        "f",
        new Map([[key("a"), skipped]]),
        both,
      );

      assert.deepStrictEqual(yield* fs.readDirectory(directory), ["aa.json"]);
    }),
  );
});

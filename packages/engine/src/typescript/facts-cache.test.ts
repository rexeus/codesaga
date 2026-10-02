import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

import { loadFactsCache, storeFactsCache } from "./facts-cache.js";
import type { FactsResult } from "./facts-of-source.js";

const skipped: FactsResult = { kind: "skipped", reason: "syntax-error" };

const temporaryFile = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "codesaga-" });
  return `${directory}/syntax-v1.json`;
});

layer(NodeServices.layer)("the facts cache file", (it) => {
  it.effect("returns the verdicts it stored under the same fingerprint", () =>
    Effect.gen(function* () {
      const file = yield* temporaryFile;

      yield* storeFactsCache(
        file,
        "fingerprint",
        new Map([["a".repeat(40), skipped]]),
      );

      assert.deepStrictEqual(
        [...(yield* loadFactsCache(file, "fingerprint"))],
        [["a".repeat(40), skipped]],
      );
    }),
  );

  it.effect("returns nothing under another fingerprint", () =>
    Effect.gen(function* () {
      const file = yield* temporaryFile;
      yield* storeFactsCache(file, "old", new Map([["a".repeat(40), skipped]]));

      assert.strictEqual((yield* loadFactsCache(file, "new")).size, 0);
    }),
  );

  it.effect("returns nothing for a missing or a damaged file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* temporaryFile;
      assert.strictEqual((yield* loadFactsCache(file, "f")).size, 0);

      yield* fs.writeFileString(file, '{"version":1,"fingerpr');

      assert.strictEqual((yield* loadFactsCache(file, "f")).size, 0);
    }),
  );

  it.effect(
    "leaves out an entry that is neither facts of this version nor a skip",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const file = yield* temporaryFile;
        yield* fs.writeFileString(
          file,
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

        assert.strictEqual((yield* loadFactsCache(file, "f")).size, 0);
      }),
  );
});

import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

import { oxcParse } from "../testing/oxc-parser.js";
import { loadFactsCache, storeFactsCache } from "./facts-cache.js";
import { digestOfSource } from "./facts-of-source.js";
import type { DigestResult } from "./facts-of-source.js";

const skipped: DigestResult = { kind: "skipped", reason: "syntax-error" };
const parsed = digestOfSource(oxcParse, {
  path: "a.ts",
  text: "export const a: any = 1;\nexport function f() {\n  if (a) {\n    return 1;\n  }\n}\n",
});

const temporaryFile = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "codesaga-" });
  return `${directory}/syntax-v1.json`;
});

const none = new Map<string, DigestResult>();

layer(NodeServices.layer)("the facts cache file", (it) => {
  it.effect(
    "returns the digests it stored under the same fingerprint, a parsed one exactly",
    () =>
      Effect.gen(function* () {
        const file = yield* temporaryFile;
        const stored = new Map([
          ["k1", parsed],
          ["k2", skipped],
        ]);

        yield* storeFactsCache(file, "fingerprint", stored, none);

        assert.deepStrictEqual(
          yield* loadFactsCache(file, "fingerprint"),
          stored,
        );
      }),
  );

  it.effect("returns nothing under another fingerprint", () =>
    Effect.gen(function* () {
      const file = yield* temporaryFile;
      yield* storeFactsCache(file, "old", new Map([["k", skipped]]), none);

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
});

layer(NodeServices.layer)("the facts cache entries", (it) => {
  it.effect("leaves out an entry that is neither a digest row nor a skip", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* temporaryFile;
      yield* fs.writeFileString(
        file,
        JSON.stringify({
          version: 1,
          fingerprint: "f",
          facts: {
            short: [1, 2, 3],
            odd: { skipped: "nonsense" },
            bare: 7,
            wrong: [1, 1, 1, 1, 1, 1, 0, "x", 1, 1, 1, 1, []],
          },
        }),
      );

      assert.strictEqual((yield* loadFactsCache(file, "f")).size, 0);
    }),
  );

  it.effect("does not rewrite a file whose keys did not change", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const file = yield* temporaryFile;
      const stored = new Map([["k", skipped]]);
      yield* storeFactsCache(file, "f", stored, none);
      yield* fs.writeFileString(file, "marker");

      yield* storeFactsCache(file, "f", stored, stored);

      assert.strictEqual(yield* fs.readFileString(file), "marker");
    }),
  );
});

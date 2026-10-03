import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Schema } from "effect";

import {
  countingParser,
  gatherOf,
  recordingServices,
} from "../testing/history-facts.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";

const SAME = "export const a = 1;\n";

/** Three distinct parsable blobs: a.ts and b.ts share one, a.ts is edited, bad.ts has a syntax error. */
const commitHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* repo.commit("2026-03-01T12:00:00Z", {
      "a.ts": SAME,
      "b.ts": SAME,
      "types.d.ts": "export declare const t: string;\n",
      "README.md": "# docs\n",
    });
    yield* repo.commit("2026-03-02T12:00:00Z", {
      "a.ts": "export const a = 2;\n",
    });
    yield* fs.symlink("a.ts", path.join(repo.directory, "link.ts"));
    yield* repo.commit("2026-03-03T12:00:00Z", {
      "bad.ts": "export const = ;\n",
    });
    yield* repo.git("rm", "b.ts");
    yield* repo.commit("2026-03-04T12:00:00Z");
  });

const cacheFile = (repo: TempRepository) =>
  `${repo.directory}/.git/codesaga/syntax-v1.json`;

/** One run: the parser it used and the blobs git was asked for. */
const run = (
  repo: TempRepository,
  options?: Parameters<typeof gatherOf>[1],
  version = "1",
) => {
  const parser = countingParser(version);
  const services = recordingServices(repo);
  return gatherOf(repo, options).pipe(
    Effect.provide(Layer.mergeAll(parser.layer, services.layer)),
    Effect.map((facts) => ({
      facts,
      parsed: parser.parsed(),
      read: services.read,
    })),
  );
};

layer(NodeServices.layer)("gatherHistoryFacts", (it) => {
  it.effect(
    "parses each distinct blob once and keys the verdicts by blob id and parse options",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitHistory(repo);

        const { facts, parsed } = yield* run(repo);

        const first = (yield* repo.git("rev-parse", "HEAD~3:a.ts")).trim();
        const edited = (yield* repo.git("rev-parse", "HEAD:a.ts")).trim();
        const bad = (yield* repo.git("rev-parse", "HEAD:bad.ts")).trim();
        assert.strictEqual(parsed, 3);
        assert.deepStrictEqual(
          Object.fromEntries(
            Array.from(facts?.factsByBlob ?? [], ([key, { kind }]) => [
              key,
              kind,
            ]),
          ),
          {
            [`${first}:ts:module`]: "parsed",
            [`${edited}:ts:module`]: "parsed",
            [`${bad}:ts:module`]: "skipped",
          },
        );
        assert.deepStrictEqual(facts?.factsByBlob.get(`${bad}:ts:module`), {
          kind: "skipped",
          reason: "syntax-error",
        });
      }),
  );

  it.effect(
    "parses and reads nothing on a second run and returns the same facts",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitHistory(repo);

        const cold = yield* run(repo);
        const warm = yield* run(repo);

        assert.strictEqual(cold.parsed, 3);
        assert.strictEqual(cold.read.length, 3);
        assert.strictEqual(warm.parsed, 0);
        assert.deepStrictEqual(warm.read, []);
        assert.deepStrictEqual(warm.facts, cold.facts);
      }),
  );

  it.effect("parses again when the parser's version changed", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitHistory(repo);
      yield* run(repo);

      const upgraded = yield* run(repo, {}, "2");

      assert.strictEqual(upgraded.parsed, 3);
    }),
  );
});

layer(NodeServices.layer)("gatherHistoryFacts and the tool's version", (it) => {
  it.effect(
    "parses again after an upgrade of the tool, which may have changed a collector",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitHistory(repo);
        yield* run(repo, { toolVersion: "1.0.0" });

        const same = yield* run(repo, { toolVersion: "1.0.0" });
        const upgraded = yield* run(repo, { toolVersion: "1.1.0" });

        assert.strictEqual(same.parsed, 0);
        assert.strictEqual(upgraded.parsed, 3);
      }),
  );
});

layer(NodeServices.layer)("gatherHistoryFacts without the cache", (it) => {
  it.effect("neither reads nor writes the cache without it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repo = yield* makeTempRepository;
      yield* commitHistory(repo);
      yield* run(repo);

      const uncached = yield* run(repo, { useCache: false });
      yield* fs.remove(cacheFile(repo), { recursive: true });
      yield* run(repo, { useCache: false });

      assert.strictEqual(uncached.parsed, 3);
      assert.isFalse(yield* fs.exists(cacheFile(repo)));
    }),
  );

  it.effect("keeps only the entries a run referenced", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repo = yield* makeTempRepository;
      yield* commitHistory(repo);
      yield* run(repo);

      yield* run(repo, { exclude: ["bad.ts"] });

      const stored = yield* Schema.decodeEffect(
        Schema.fromJsonString(
          Schema.Struct({
            facts: Schema.Record(Schema.String, Schema.Unknown),
          }),
        ),
      )(yield* fs.readFileString(cacheFile(repo)));
      assert.strictEqual(Object.keys(stored.facts).length, 2);
    }),
  );
});

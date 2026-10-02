import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";

import { Git } from "../git/git.js";
import { readHistory } from "../history/history.js";
import { oxcParse } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { factsOfSource } from "./facts-of-source.js";
import { gatherHistoryFacts } from "./history-facts.js";
import { TypeScriptParser } from "./typescript-parser.js";

/** The real parser that records how many sources each call was given. */
const countingParser = (version: string) => {
  const calls: Array<number> = [];
  const parser = Layer.succeed(
    TypeScriptParser,
    TypeScriptParser.of({
      status: Effect.succeed({ kind: "ready", name: "oxc-parser", version }),
      factsOf: (sources) =>
        Effect.sync(() => {
          calls.push(sources.length);
          return sources.map((source) => factsOfSource(oxcParse, source));
        }),
    }),
  );
  return { parser, parsed: () => calls.reduce((sum, n) => sum + n, 0) };
};

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

const gather = (repo: TempRepository, useCache: boolean) =>
  Effect.gen(function* () {
    const head = (yield* repo.git("rev-parse", "HEAD")).trim();
    const { commits } = yield* readHistory({
      root: repo.directory,
      head,
      shallowBoundary: new Set(),
      useCache: false,
    });
    return yield* gatherHistoryFacts({
      root: repo.directory,
      head,
      commits,
      useCache,
    });
  }).pipe(Effect.provide(Git.layer(repo.directory)));

const cacheFile = (repo: TempRepository) =>
  `${repo.directory}/.git/codesaga/syntax-v1.json`;

layer(NodeServices.layer)("gatherHistoryFacts", (it) => {
  it.effect(
    "parses each distinct blob once and keys the verdicts by full blob id",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitHistory(repo);
        const { parser, parsed } = countingParser("1");

        const facts = yield* gather(repo, true).pipe(Effect.provide(parser));

        const first = (yield* repo.git("rev-parse", "HEAD~3:a.ts")).trim();
        const edited = (yield* repo.git("rev-parse", "HEAD:a.ts")).trim();
        const bad = (yield* repo.git("rev-parse", "HEAD:bad.ts")).trim();
        assert.strictEqual(parsed(), 3);
        assert.deepStrictEqual(
          Object.fromEntries(
            Array.from(facts?.factsByOid ?? [], ([oid, { kind }]) => [
              oid,
              kind,
            ]),
          ),
          { [first]: "parsed", [edited]: "parsed", [bad]: "skipped" },
        );
        assert.deepStrictEqual(facts?.factsByOid.get(bad), {
          kind: "skipped",
          reason: "syntax-error",
        });
      }),
  );
});

layer(NodeServices.layer)("gatherHistoryFacts with the cache", (it) => {
  it.effect("parses nothing on a second run and returns the same facts", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitHistory(repo);
      const cold = countingParser("1");
      const warm = countingParser("1");

      const first = yield* gather(repo, true).pipe(Effect.provide(cold.parser));
      const second = yield* gather(repo, true).pipe(
        Effect.provide(warm.parser),
      );

      assert.strictEqual(cold.parsed(), 3);
      assert.strictEqual(warm.parsed(), 0);
      assert.deepStrictEqual(second, first);
    }),
  );

  it.effect("parses again when the parser's version changed", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitHistory(repo);
      yield* gather(repo, true).pipe(
        Effect.provide(countingParser("1").parser),
      );
      const upgraded = countingParser("2");

      yield* gather(repo, true).pipe(Effect.provide(upgraded.parser));

      assert.strictEqual(upgraded.parsed(), 3);
    }),
  );

  it.effect("neither reads nor writes the cache without it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repo = yield* makeTempRepository;
      yield* commitHistory(repo);
      yield* gather(repo, true).pipe(
        Effect.provide(countingParser("1").parser),
      );
      const uncached = countingParser("1");
      yield* gather(repo, false).pipe(Effect.provide(uncached.parser));
      assert.strictEqual(uncached.parsed(), 3);

      yield* fs.remove(cacheFile(repo));
      yield* gather(repo, false).pipe(
        Effect.provide(countingParser("1").parser),
      );

      assert.isFalse(yield* fs.exists(cacheFile(repo)));
    }),
  );
});

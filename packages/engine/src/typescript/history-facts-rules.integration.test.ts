import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";

import {
  countingParser,
  gatherOf,
  recordingServices,
} from "../testing/history-facts.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";

/** Valid TypeScript, a syntax error as TSX. */
const ANGLE_CAST = "const x = <string>y;\n";

const run = (
  repo: TempRepository,
  options?: Parameters<typeof gatherOf>[1],
) => {
  const parser = countingParser();
  const services = recordingServices(repo);
  return gatherOf(repo, options).pipe(
    Effect.provide(Layer.mergeAll(parser.layer, services.layer)),
    Effect.map((facts) => ({
      facts,
      parsed: parser.parsed(),
      read: services.read,
      progress: services.progress,
    })),
  );
};

const blobOf = (repo: TempRepository, path: string) =>
  repo.git("rev-parse", `HEAD:${path}`).pipe(Effect.map((id) => id.trim()));

const verdicts = (
  facts: { factsByBlob: ReadonlyMap<string, { kind: string }> } | undefined,
) =>
  Object.fromEntries(
    Array.from(facts?.factsByBlob ?? [], ([key, result]) => [key, result.kind]),
  );

const expectOnePerOptionSet = (first: string, second: string) =>
  Effect.gen(function* () {
    const repo = yield* makeTempRepository;
    yield* repo.commit("2026-03-01T12:00:00Z", { [first]: ANGLE_CAST });
    yield* repo.commit("2026-03-02T12:00:00Z", { [second]: ANGLE_CAST });
    const oid = yield* blobOf(repo, "a.ts");

    const cold = yield* run(repo);
    const warm = yield* run(repo);

    assert.deepStrictEqual(verdicts(cold.facts), {
      [`${oid}:ts:module`]: "parsed",
      [`${oid}:tsx:module`]: "skipped",
    });
    assert.deepStrictEqual(cold.read, [oid]);
    assert.strictEqual(cold.parsed, 2);
    assert.strictEqual(warm.parsed, 0);
    assert.deepStrictEqual(warm.facts, cold.facts);
  });

layer(NodeServices.layer)("gatherHistoryFacts parse options", (it) => {
  it.effect(
    "judges the same blob once as .ts and once as .tsx, the .ts commit first",
    () => expectOnePerOptionSet("a.ts", "b.tsx"),
  );

  it.effect(
    "judges the same blob once as .ts and once as .tsx, the .tsx commit first",
    () => expectOnePerOptionSet("b.tsx", "a.ts"),
  );
});

layer(NodeServices.layer)("gatherHistoryFacts guards", (it) => {
  it.effect(
    "keeps the minified and too-large verdicts, so a warm run reads neither blob",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "min.ts": `${"a=1;".repeat(200)}\n`,
          "huge.ts": "// padding\n".repeat(100_000),
          "ok.ts": "export const ok = 1;\n",
        });
        const [minified, huge, ok] = [
          yield* blobOf(repo, "min.ts"),
          yield* blobOf(repo, "huge.ts"),
          yield* blobOf(repo, "ok.ts"),
        ];

        const cold = yield* run(repo);
        const warm = yield* run(repo);

        assert.strictEqual(cold.parsed, 2);
        assert.deepStrictEqual(
          Object.fromEntries(
            Array.from(cold.facts?.factsByBlob ?? [], ([key, result]) => [
              key,
              result.kind === "skipped" ? result.reason : result.kind,
            ]),
          ),
          {
            [`${minified}:ts:module`]: "minified",
            [`${huge}:ts:module`]: "too-large",
            [`${ok}:ts:module`]: "parsed",
          },
        );
        assert.deepStrictEqual(warm.read, []);
        assert.strictEqual(warm.parsed, 0);
        assert.deepStrictEqual(warm.facts, cold.facts);
      }),
  );
});

layer(NodeServices.layer)("gatherHistoryFacts universe rules", (it) => {
  it.effect(
    "never reads committed bundles, vendored, generated or excluded files",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "src/app.ts": "export const app = 1;\n",
          "dist/out.ts": "export const out = 2;\n",
          "vendor/lib.ts": "export const lib = 3;\n",
          "src/app.min.ts": "export const min = 4;\n",
          "src/gen.ts": "export const gen = 5;\n",
          "src/skipped.ts": "export const skipped = 6;\n",
          ".gitattributes": "src/gen.ts linguist-generated\n",
        });

        const { read, parsed } = yield* run(repo, {
          exclude: ["src/skipped.ts"],
        });

        assert.deepStrictEqual(read, [yield* blobOf(repo, "src/app.ts")]);
        assert.strictEqual(parsed, 1);
      }),
  );
});

layer(NodeServices.layer)("gatherHistoryFacts and git's ignore rules", (it) => {
  it.effect(
    "never reads a file today's .gitignore matches, though it was committed",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "src/app.ts": "export const app = 1;\n",
          "scratchpad/note.ts": "export const note = 2;\n",
        });
        yield* repo.commit("2026-03-02T12:00:00Z", {
          ".gitignore": "scratchpad/\n",
        });

        const { read, parsed } = yield* run(repo);

        assert.deepStrictEqual(read, [yield* blobOf(repo, "src/app.ts")]);
        assert.strictEqual(parsed, 1);
      }),
  );
});

layer(NodeServices.layer)(
  "gatherHistoryFacts and the first-parent chain",
  (it) => {
    it.effect("digests a blob only a merge names, and reports the chain", () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "a.ts": "export const a = 1;\n",
        });
        yield* repo.git("checkout", "-q", "-b", "side");
        yield* repo.commit("2026-03-02T12:00:00Z", {
          "side.ts": "export const s = 1;\n",
        });
        yield* repo.git("checkout", "-q", "-");
        yield* repo.commit("2026-03-03T12:00:00Z", {
          "main.ts": "export const m = 1;\n",
        });
        yield* repo.git("merge", "--no-ff", "--no-commit", "side");
        yield* repo.commit("2026-03-04T12:00:00Z", {
          "evil.ts": "export const e = 1;\n",
        });
        const evil = yield* blobOf(repo, "evil.ts");

        const { facts } = yield* run(repo);

        assert.strictEqual(
          facts?.factsByBlob.get(`${evil}:ts:module`)?.kind,
          "parsed",
        );
        assert.strictEqual(facts?.firstParent.length, 3);
      }),
    );
  },
);

layer(NodeServices.layer)("gatherHistoryFacts progress", (it) => {
  it.effect(
    "reports the missing blobs as the total, and nothing when none is missing",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "a.ts": "export const a = 1;\n",
        });
        yield* repo.commit("2026-03-02T12:00:00Z", {
          "a.ts": "export const a = 2;\n",
        });
        yield* repo.commit("2026-03-03T12:00:00Z", {
          "b.ts": "export const b = 3;\n",
        });

        const cold = yield* run(repo);
        const warm = yield* run(repo);

        assert.deepStrictEqual(cold.progress, [[3, 3]]);
        assert.deepStrictEqual(warm.progress, []);
      }),
  );
});

import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Stream } from "effect";

import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { readBlobs } from "./blob-reader.js";
import type { BlobRead, BlobRef, ReadOptions } from "./blob-reader.js";
import { Git } from "./git.js";

const byOid = (reads: ReadonlyArray<BlobRead>) =>
  reads.toSorted((a, b) => a.oid.localeCompare(b.oid));

const read = (
  repo: TempRepository,
  blobs: ReadonlyArray<BlobRef>,
  options?: ReadOptions,
) =>
  Stream.runCollect(readBlobs(blobs, options)).pipe(
    Effect.map(byOid),
    Effect.provide(Git.layer(repo.directory)),
  );

const blobId = (repo: TempRepository, path: string) =>
  repo.git("rev-parse", `HEAD:${path}`).pipe(Effect.map((id) => id.trim()));

const multiByte = "héllo → 日本語 😀\nsecond line\n";
const manyLines = Array.from({ length: 40_000 }, (_, i) => `line ${i}\n`).join(
  "",
);

layer(NodeServices.layer)("readBlobs", (it) => {
  it.effect(
    "returns the exact text of a multi-byte and a multi-chunk blob and skips invalid UTF-8 as binary",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "plain.ts": "const a = 1;\n",
          "multi.ts": multiByte,
          "large.ts": manyLines,
          "invalid.ts": Uint8Array.of(0x61, 0xff, 0xfe, 0x0a),
        });
        const ids = {
          plain: yield* blobId(repo, "plain.ts"),
          multi: yield* blobId(repo, "multi.ts"),
          large: yield* blobId(repo, "large.ts"),
          invalid: yield* blobId(repo, "invalid.ts"),
        };

        const reads = yield* read(
          repo,
          Object.values(ids).map((oid) => ({ oid })),
        );

        assert.deepStrictEqual(
          reads,
          byOid([
            { oid: ids.plain, text: "const a = 1;\n" },
            { oid: ids.multi, text: multiByte },
            { oid: ids.large, text: manyLines },
            { oid: ids.invalid, skipped: "binary" },
          ]),
        );
      }),
  );
});

layer(NodeServices.layer)("readBlobs skips", (it) => {
  it.effect(
    "skips a symlink and a submodule by mode, and an absent or malformed id as unreadable",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repo = yield* makeTempRepository;
        yield* fs.symlink("plain.ts", path.join(repo.directory, "link.ts"));
        yield* repo.commit("2026-03-01T12:00:00Z", { "plain.ts": "x\n" });
        const plain = yield* blobId(repo, "plain.ts");
        const link = yield* blobId(repo, "link.ts");
        const absent = "1".repeat(40);

        const reads = yield* read(repo, [
          { oid: plain, mode: "100644" },
          { oid: link, mode: "120000" },
          { oid: absent, mode: "160000" },
          { oid: absent },
          { oid: "HEAD:plain.ts" },
        ]);

        assert.deepStrictEqual(
          reads,
          byOid([
            { oid: plain, text: "x\n" },
            { oid: link, skipped: "symlink" },
            { oid: absent, skipped: "submodule" },
            { oid: absent, skipped: "unreadable" },
            { oid: "HEAD:plain.ts", skipped: "unreadable" },
          ]),
        );
      }),
  );

  it.effect(
    "skips a blob over maxBytes as too-large by the size git reports, and still reads the ones after it",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          "big.ts": "é".repeat(600),
          "small.ts": "x\n",
        });
        const big = yield* blobId(repo, "big.ts");
        const small = yield* blobId(repo, "small.ts");

        const reads = yield* read(repo, [{ oid: big }, { oid: small }], {
          maxBytes: 1_000,
        });

        assert.deepStrictEqual(
          reads,
          byOid([
            { oid: big, skipped: "too-large" },
            { oid: small, text: "x\n" },
          ]),
        );
      }),
  );
});

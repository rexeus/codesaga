import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Stream } from "effect";

import { fieldsOf } from "../testing/error-fields.js";
import { setScopedEnv } from "../testing/scoped-env.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { GitCommandFailed, GitNotFound } from "./git-errors.js";
import { Git } from "./git.js";

layer(NodeServices.layer)("Git", (it) => {
  it.effect("returns the stdout of a command run in its directory", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.txt": "a\n" });
      const git = yield* Git.make(repo.directory);

      const listed = yield* git.text(["ls-files", "-z"]);

      assert.strictEqual(listed, "a.txt\0");
    }),
  );

  it.effect("writes stdin to the process", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      const git = yield* Git.make(repo.directory);

      const hash = yield* git.text(["hash-object", "--stdin"], "hello\n");

      assert.strictEqual(
        hash.trim(),
        "ce013625030ba8dba906f756967f9e9ca394464a",
      );
    }),
  );
});

layer(NodeServices.layer)("Git bytes", (it) => {
  it.effect("streams stdout as raw bytes, invalid UTF-8 included", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", {
        "raw.bin": Uint8Array.of(0xff, 0x00, 0xc3, 0x28),
      });
      const git = yield* Git.make(repo.directory);

      const chunks = yield* Stream.runCollect(
        git.bytes(["cat-file", "blob", "HEAD:raw.bin"]),
      );

      assert.deepStrictEqual(
        chunks.flatMap((chunk) => Array.from(chunk)),
        [0xff, 0x00, 0xc3, 0x28],
      );
    }),
  );
});

layer(NodeServices.layer)("Git exit codes", (it) => {
  it.effect(
    "fails with the exit code and stderr of a command that exits non-zero",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        const git = yield* Git.make(repo.directory);
        yield* setScopedEnv({ LC_ALL: "C" });

        const failure = yield* Effect.flip(
          Stream.runCollect(
            git.stream(["rev-parse", "--verify", "missing-ref"]),
          ),
        );

        assert.deepStrictEqual(
          fieldsOf(failure),
          fieldsOf(
            new GitCommandFailed({
              args: ["rev-parse", "--verify", "missing-ref"],
              exitCode: 128,
              stderr: "fatal: Needed a single revision",
            }),
          ),
        );
      }),
  );
});

layer(NodeServices.layer)("Git failures to start", (it) => {
  it.effect("fails with GitNotFound when git is not on PATH", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      const git = yield* Git.make(repo.directory);
      yield* setScopedEnv({ PATH: "" });

      const failure = yield* Effect.flip(git.text(["--version"]));

      assert.deepStrictEqual(fieldsOf(failure), fieldsOf(new GitNotFound()));
    }),
  );

  it.effect("fails with a GitCommandFailed when its directory is a file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();
      const file = `${directory}/not-a-directory`;
      yield* fs.writeFileString(file, "x\n");
      const git = yield* Git.make(file);

      const failure = yield* Effect.flip(git.text(["--version"]));

      assert.deepStrictEqual(
        fieldsOf(failure),
        fieldsOf(
          new GitCommandFailed({
            args: ["--version"],
            exitCode: -1,
            stderr: "spawn ENOTDIR",
          }),
        ),
      );
    }),
  );
});

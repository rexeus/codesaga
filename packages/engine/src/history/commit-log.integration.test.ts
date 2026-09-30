import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { readCommits } from "./commit-log.js";

const cacheFileOf = (repo: TempRepository) =>
  Effect.map(Path.Path, (path) =>
    path.join(repo.directory, ".git", "codesaga", "history-v1.json"),
  );

/** Reads the commits of HEAD and reports the revisions every `git log` of the read was asked for. */
const read = (
  repo: TempRepository,
  options: {
    readonly useCache?: boolean;
    readonly shallowBoundary?: ReadonlySet<string>;
  } = {},
) =>
  Effect.gen(function* () {
    const logged: Array<string> = [];
    const recording = Layer.effect(
      Git,
      Effect.map(Git.make(repo.directory), (real) =>
        Git.of({
          text: (args, stdin) => real.text(args, stdin),
          stream: (args, stdin) => {
            if (args[0] === "log") {
              logged.push(args.at(-1) ?? "");
            }
            return real.stream(args, stdin);
          },
        }),
      ),
    );
    const head = (yield* repo.git("rev-parse", "HEAD")).trim();
    const commits = yield* readCommits({
      root: repo.directory,
      head,
      shallowBoundary: options.shallowBoundary ?? new Set(),
      useCache: options.useCache ?? true,
    }).pipe(Effect.provide(recording));
    return { head, commits, logged };
  });

const commitTwice = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "a\n" });
    yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": "a\nb\n" });
  });

layer(NodeServices.layer)("readCommits with the cache", (it) => {
  it.effect(
    "reads the log once and writes the cache into the git directory",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* makeTempRepository;
        yield* commitTwice(repo);

        const { head, logged } = yield* read(repo);

        assert.deepStrictEqual(logged, [head]);
        assert.isTrue(yield* fs.exists(yield* cacheFileOf(repo)));
        assert.strictEqual(yield* repo.git("status", "--porcelain"), "");
      }),
  );

  it.effect(
    "answers a second read of the same head without running git log",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitTwice(repo);
        const first = yield* read(repo);

        const second = yield* read(repo);

        assert.deepStrictEqual(second.logged, []);
        assert.deepStrictEqual(second.commits, first.commits);
      }),
  );

  it.effect("reads only the new commits after the history grew", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitTwice(repo);
      const before = yield* read(repo);
      yield* repo.commit("2026-03-03T12:00:00Z", { "b.ts": "b\n" });

      const cached = yield* read(repo);
      const fresh = yield* read(repo, { useCache: false });

      assert.deepStrictEqual(cached.logged, [`${before.head}..${cached.head}`]);
      assert.deepStrictEqual(cached.commits, fresh.commits);
      assert.lengthOf(cached.commits, 3);
    }),
  );
});

layer(NodeServices.layer)("readCommits after the history changed", (it) => {
  it.effect("reads everything again after the history was rewritten", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitTwice(repo);
      yield* read(repo);
      yield* repo.git(
        "commit",
        "--amend",
        "--allow-empty",
        "--message",
        "again",
      );

      const cached = yield* read(repo);
      const fresh = yield* read(repo, { useCache: false });

      assert.deepStrictEqual(cached.logged, [cached.head]);
      assert.deepStrictEqual(cached.commits, fresh.commits);
      assert.strictEqual(cached.commits[0]?.sha, cached.head);
    }),
  );

  it.effect(
    "reads everything again after a reset to an older commit and a new commit",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitTwice(repo);
        yield* repo.commit("2026-03-03T12:00:00Z", { "c.ts": "c\n" });
        yield* read(repo);
        yield* repo.git("reset", "--hard", "HEAD~2");
        yield* repo.commit("2026-03-04T12:00:00Z", { "d.ts": "d\n" });

        const cached = yield* read(repo);
        const fresh = yield* read(repo, { useCache: false });

        assert.deepStrictEqual(cached.logged, [cached.head]);
        assert.deepStrictEqual(cached.commits, fresh.commits);
      }),
  );
});

layer(NodeServices.layer)("readCommits after git settings changed", (it) => {
  it.effect("rereads with a mailmap edited in the work tree", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repo = yield* makeTempRepository;
      yield* commitTwice(repo);
      const before = yield* read(repo);
      yield* fs.writeFileString(
        `${repo.directory}/.mailmap`,
        "Mapped <mapped@example.com> <test@codesaga.invalid>\n",
      );

      const cached = yield* read(repo);

      assert.deepStrictEqual(cached.logged, [before.head]);
      assert.strictEqual(cached.commits[0]?.author.name, "Mapped");
    }),
  );

  it.effect("rereads with the content of mailmap.file edited", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repo = yield* makeTempRepository;
      const mailmap = `${repo.directory}/.git/mailmap-elsewhere`;
      yield* commitTwice(repo);
      yield* repo.git("config", "mailmap.file", mailmap);
      yield* fs.writeFileString(mailmap, "");
      yield* read(repo);
      yield* fs.writeFileString(
        mailmap,
        "Mapped <mapped@example.com> <test@codesaga.invalid>\n",
      );

      const cached = yield* read(repo);

      assert.lengthOf(cached.logged, 1);
      assert.strictEqual(cached.commits[0]?.author.name, "Mapped");
    }),
  );

  it.effect("rereads with another shallow boundary", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitTwice(repo);
      yield* read(repo);

      const cached = yield* read(repo, {
        shallowBoundary: new Set(["0".repeat(40)]),
      });

      assert.lengthOf(cached.logged, 1);
    }),
  );
});

layer(NodeServices.layer)(
  "readCommits when the cache is off or unusable",
  (it) => {
    it.effect("neither reads nor writes the cache when it is off", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* makeTempRepository;
        yield* commitTwice(repo);

        const first = yield* read(repo, { useCache: false });
        const second = yield* read(repo, { useCache: false });

        assert.lengthOf(first.logged, 1);
        assert.lengthOf(second.logged, 1);
        assert.isFalse(yield* fs.exists(yield* cacheFileOf(repo)));
      }),
    );

    it.effect.each([
      ["not JSON", "{ torn"],
      ["JSON of another shape", '{"version":1,"head":"abc"}'],
      [
        "another version",
        '{"version":2,"head":"abc","fingerprint":"","commits":[]}',
      ],
    ])("rereads and repairs a cache that is %s", ([, content]) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* makeTempRepository;
        yield* commitTwice(repo);
        const file = yield* cacheFileOf(repo);
        yield* fs.makeDirectory(`${repo.directory}/.git/codesaga`, {
          recursive: true,
        });
        yield* fs.writeFileString(file, content ?? "");

        const cached = yield* read(repo);
        const again = yield* read(repo);

        assert.deepStrictEqual(cached.logged, [cached.head]);
        assert.deepStrictEqual(again.logged, []);
        assert.deepStrictEqual(again.commits, cached.commits);
      }),
    );

    it.effect("reads the log every time when the cache cannot be written", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* makeTempRepository;
        yield* commitTwice(repo);
        // A file where the cache directory belongs, which fails for any user.
        yield* fs.writeFileString(`${repo.directory}/.git/codesaga`, "");

        const first = yield* read(repo);
        const second = yield* read(repo);

        assert.lengthOf(first.commits, 2);
        assert.deepStrictEqual(second.logged, [second.head]);
        assert.deepStrictEqual(second.commits, first.commits);
      }),
    );
  },
);
